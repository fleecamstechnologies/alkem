import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Dispense } from './entities/dispense.entity';
import { DispenseItem } from './entities/dispense-item.entity';
import { Drug } from './entities/drug.entity';
import { StockService } from './stock.service';
import { PatientBillingService } from '../patients/patient-billing.service';
import { Patient } from '../patients/entities/patient.entity';
import {
  DispenseStatus,
  PharmacyMovementKind,
} from '../common/enums/pharmacy.enum';
import {
  ChargeKind,
  ChargeStatus,
  ServiceKind,
} from '../common/enums/patient.enum';
import { CreateDispenseDto, QueryDispensesDto } from './pharmacy.dto';
import { addMoney, fromPaise, toPaise } from '../common/utils/money.util';
import { Paginated } from '../common/dto/pagination';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class DispensesService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly stock: StockService,
    private readonly billing: PatientBillingService,
    private readonly auditService: AuditService,
  ) {}

  private async nextDispenseNo(
    manager: EntityManager,
    date: string,
  ): Promise<string> {
    const ymd = date.replace(/-/g, '');
    const row = await manager.query(
      `SELECT COUNT(*) AS c FROM dispenses WHERE dispenseNo LIKE ?`,
      [`DSP-${ymd}-%`],
    );
    const seq = Number(row[0]?.c ?? 0) + 1;
    return `DSP-${ymd}-${String(seq).padStart(4, '0')}`;
  }

  async create(
    dto: CreateDispenseDto,
    actor: AuthenticatedUser,
  ): Promise<Dispense> {
    if (!dto.lines?.length) {
      throw new BadRequestException('At least one line is required');
    }
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const patient = await this.ds
      .getRepository(Patient)
      .findOne({ where: { id: String(dto.patientId) } });
    if (!patient) {
      throw new NotFoundException(`Patient ${dto.patientId} not found`);
    }

    // 1) Stock + dispense rows in one transaction.
    const built = await this.ds.transaction(async (manager) => {
      const dispenseNo = await this.nextDispenseNo(manager, today);
      const dispense = await manager.getRepository(Dispense).save(
        manager.getRepository(Dispense).create({
          dispenseNo,
          patientId: String(dto.patientId),
          prescriptionId:
            dto.prescriptionId != null ? String(dto.prescriptionId) : null,
          visitId: dto.visitId != null ? String(dto.visitId) : null,
          status: DispenseStatus.DISPENSED,
          dispensedByUserId: actor.userId,
          dispensedAt: now,
        }),
      );

      let subtotalPaise = 0n;
      let discountPaise = 0n;
      let gstTotalPaise = 0n;

      for (const line of dto.lines) {
        const drug = await manager
          .getRepository(Drug)
          .findOne({ where: { id: String(line.drugId) } });
        if (!drug) {
          throw new BadRequestException(`Drug ${line.drugId} not found`);
        }
        const lineDiscount = toPaise(line.discount ?? '0');
        const allocations = await this.stock.allocateFefo(
          manager,
          String(line.drugId),
          line.quantity,
        );

        // spread the line discount across the allocated splits pro-rata
        const lineQtyPaise = toPaise(line.quantity);
        let discountLeft = lineDiscount;
        for (let idx = 0; idx < allocations.length; idx++) {
          const alloc = allocations[idx];
          const allocQty = toPaise(alloc.qty);
          const gross = (allocQty * toPaise(alloc.mrp)) / 100n;
          const isLast = idx === allocations.length - 1;
          const allocDiscount = isLast
            ? discountLeft
            : lineQtyPaise > 0n
              ? (lineDiscount * allocQty) / lineQtyPaise
              : 0n;
          discountLeft -= allocDiscount;
          const net = gross - allocDiscount;
          const lineGst = (net * toPaise(drug.gstRate)) / 10000n;

          subtotalPaise += gross;
          discountPaise += allocDiscount;
          gstTotalPaise += lineGst;

          await manager.getRepository(DispenseItem).insert({
            dispenseId: dispense.id,
            drugId: String(line.drugId),
            batchId: alloc.batchId,
            prescriptionItemId:
              line.prescriptionItemId != null
                ? String(line.prescriptionItemId)
                : null,
            quantity: alloc.qty,
            mrp: alloc.mrp,
            gstRate: drug.gstRate,
            discount: fromPaise(allocDiscount),
            lineTotal: fromPaise(net),
          });

          await this.stock.applyMovement(manager, {
            drugId: String(line.drugId),
            batchId: alloc.batchId,
            kind: PharmacyMovementKind.DISPENSE_OUT,
            signedQty: `-${alloc.qty}`,
            movementDate: today,
            refType: 'DISPENSE',
            refId: dispense.id,
            actorUserId: actor.userId,
          });
        }
      }

      dispense.subtotal = fromPaise(subtotalPaise);
      dispense.discount = fromPaise(discountPaise);
      dispense.gstAmount = fromPaise(gstTotalPaise);
      dispense.total = fromPaise(subtotalPaise - discountPaise);
      const saved = await manager.getRepository(Dispense).save(dispense);
      return { id: saved.id, dispenseNo, total: saved.total };
    });

    // 2) Post the PHARMACY invoice onto the patient ledger (own tx). If it
    //    fails, compensate by cancelling the dispense (returns stock).
    let chargeId: string;
    try {
      const charge = await this.billing.addCharge(
        String(dto.patientId),
        {
          kind: ChargeKind.INVOICE,
          amount: built.total,
          chargeDate: today,
          serviceKind: ServiceKind.PHARMACY,
          description: `Pharmacy dispense ${built.dispenseNo}`,
          visitId: dto.visitId,
          status: ChargeStatus.PENDING,
        },
        actor,
      );
      chargeId = charge.id;
    } catch (err) {
      await this.cancel(built.id, actor).catch(() => undefined);
      throw err;
    }

    await this.ds
      .getRepository(Dispense)
      .update(built.id, { patientChargeId: chargeId });

    await this.auditService.record({
      entityName: 'Dispense',
      entityId: built.id,
      action: AuditAction.CREATE,
      user: actor,
      reason: `${built.dispenseNo}; total ${built.total}`,
    });

    return this.ds.getRepository(Dispense).findOneOrFail({
      where: { id: built.id },
    });
  }

  async list(query: QueryDispensesDto): Promise<Paginated<Dispense>> {
    const limit = query.limit ?? 50;
    const qb = this.ds.getRepository(Dispense).createQueryBuilder('d');
    if (query.patientId != null) {
      qb.andWhere('d.patientId = :pid', { pid: query.patientId });
    }
    if (query.from) {
      qb.andWhere('d.dispensedAt >= :from', { from: `${query.from} 00:00:00` });
    }
    if (query.to) {
      qb.andWhere('d.dispensedAt <= :to', { to: `${query.to} 23:59:59` });
    }
    qb.orderBy('d.id', 'DESC').take(limit);
    if (query.cursor) {
      qb.andWhere('d.id < :cursor', { cursor: query.cursor });
    } else if (query.page && query.page > 1) {
      qb.skip((query.page - 1) * limit);
    }
    const rows = await qb.getMany();
    const nextCursor =
      rows.length === limit ? rows[rows.length - 1].id : null;

    // Attach patient display names for the page.
    const pids = [...new Set(rows.map((r) => String(r.patientId)))];
    const patients: Array<{ id: string; name: string; code: string }> =
      pids.length
        ? await this.ds.query(
            `SELECT id, CONCAT(firstName,' ',lastName) AS name, code
             FROM patients WHERE id IN (${pids.map(() => '?').join(',')})`,
            pids,
          )
        : [];
    const pMap = new Map(patients.map((p) => [String(p.id), p]));
    const enriched = rows.map((r) => ({
      ...r,
      patientName: pMap.get(String(r.patientId))?.name ?? null,
      patientCode: pMap.get(String(r.patientId))?.code ?? null,
    }));
    return {
      rows: enriched as unknown as Dispense[],
      nextCursor,
      total: null,
      limit,
    };
  }

  async get(id: string) {
    const dispense = await this.ds
      .getRepository(Dispense)
      .findOne({ where: { id } });
    if (!dispense) throw new NotFoundException(`Dispense ${id} not found`);
    const items = await this.ds.query(
      `SELECT di.*, d.code AS drugCode, d.name AS drugName,
              b.batchNo, DATE_FORMAT(b.expiryDate,'%Y-%m-%d') AS expiryDate
       FROM dispense_items di
       JOIN drugs d ON d.id = di.drugId
       LEFT JOIN drug_batches b ON b.id = di.batchId
       WHERE di.dispenseId = ? ORDER BY di.id ASC`,
      [id],
    );
    const patient = await this.ds
      .getRepository(Patient)
      .findOne({ where: { id: dispense.patientId } });
    return {
      ...dispense,
      items,
      patientName: patient
        ? `${patient.firstName} ${patient.lastName}`
        : null,
    };
  }

  /** Cancel a dispense: return stock, void the linked patient charge. */
  async cancel(id: string, actor: AuthenticatedUser): Promise<Dispense> {
    const today = new Date().toISOString().slice(0, 10);
    return this.ds.transaction(async (manager) => {
      const dispense = await manager
        .getRepository(Dispense)
        .createQueryBuilder('d')
        .setLock('pessimistic_write')
        .where('d.id = :id', { id })
        .getOne();
      if (!dispense) throw new NotFoundException(`Dispense ${id} not found`);
      if (dispense.status !== DispenseStatus.DISPENSED) {
        throw new BadRequestException('Dispense is already cancelled');
      }
      const items = await manager
        .getRepository(DispenseItem)
        .find({ where: { dispenseId: id } });
      for (const it of items) {
        await this.stock.applyMovement(manager, {
          drugId: it.drugId,
          batchId: it.batchId,
          kind: PharmacyMovementKind.RETURN_IN,
          signedQty: it.quantity,
          movementDate: today,
          refType: 'DISPENSE_CANCEL',
          refId: id,
          actorUserId: actor.userId,
        });
      }
      dispense.status = DispenseStatus.CANCELLED;
      const saved = await manager.getRepository(Dispense).save(dispense);

      if (dispense.patientChargeId) {
        await this.billing.updateChargeStatus(
          dispense.patientChargeId,
          ChargeStatus.CANCELLED,
        );
      }
      await this.auditService.record({
        entityName: 'Dispense',
        entityId: id,
        action: AuditAction.UPDATE,
        user: actor,
        reason: 'Cancelled; stock returned, charge voided',
      });
      return saved;
    });
  }
}
