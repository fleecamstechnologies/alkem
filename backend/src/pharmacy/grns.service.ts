import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Grn } from './entities/grn.entity';
import { GrnItem } from './entities/grn-item.entity';
import { Drug } from './entities/drug.entity';
import { DrugBatch } from './entities/drug-batch.entity';
import { Supplier } from './entities/supplier.entity';
import { StockService } from './stock.service';
import { GrnStatus, PharmacyMovementKind } from '../common/enums/pharmacy.enum';
import {
  CreateGrnDto,
  GrnItemDto,
  QueryGrnsDto,
  SetGrnItemsDto,
} from './pharmacy.dto';
import { addMoney, fromPaise, toPaise } from '../common/utils/money.util';
import { Paginated } from '../common/dto/pagination';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

function lineTotalPaise(item: GrnItemDto): bigint {
  const qty = toPaise(item.quantity);
  const price = toPaise(item.purchasePrice);
  return (qty * price) / 100n;
}
function gstPaise(basePaise: bigint, rate: string): bigint {
  return (basePaise * toPaise(rate)) / 10000n;
}

@Injectable()
export class GrnsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly stock: StockService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: QueryGrnsDto): Promise<Paginated<Grn>> {
    const limit = query.limit ?? 50;
    const qb = this.ds.getRepository(Grn).createQueryBuilder('g');
    if (query.supplierId != null) {
      qb.andWhere('g.supplierId = :sid', { sid: query.supplierId });
    }
    if (query.status) {
      qb.andWhere('g.status = :st', { st: query.status });
    }
    qb.orderBy('g.id', 'DESC').take(limit);
    if (query.cursor) {
      qb.andWhere('g.id < :cursor', { cursor: query.cursor });
    } else if (query.page && query.page > 1) {
      qb.skip((query.page - 1) * limit);
    }
    const rows = await qb.getMany();
    const nextCursor =
      rows.length === limit ? rows[rows.length - 1].id : null;
    return { rows, nextCursor, total: null, limit };
  }

  async get(id: string) {
    const grn = await this.ds.getRepository(Grn).findOne({ where: { id } });
    if (!grn) throw new NotFoundException(`GRN ${id} not found`);
    const items = await this.ds.query(
      `SELECT gi.*, d.code AS drugCode, d.name AS drugName,
              DATE_FORMAT(gi.expiryDate,'%Y-%m-%d') AS expiryDate
       FROM grn_items gi JOIN drugs d ON d.id = gi.drugId
       WHERE gi.grnId = ? ORDER BY gi.id ASC`,
      [id],
    );
    const supplier = await this.ds
      .getRepository(Supplier)
      .findOne({ where: { id: grn.supplierId } });
    return { ...grn, items, supplierName: supplier?.name ?? null };
  }

  private async nextGrnNo(manager: EntityManager, date: string): Promise<string> {
    const ymd = date.replace(/-/g, '');
    const row = await manager.query(
      `SELECT COUNT(*) AS c FROM grns WHERE grnNo LIKE ?`,
      [`GRN-${ymd}-%`],
    );
    const seq = Number(row[0]?.c ?? 0) + 1;
    return `GRN-${ymd}-${String(seq).padStart(3, '0')}`;
  }

  async create(dto: CreateGrnDto, actor: AuthenticatedUser): Promise<Grn> {
    return this.ds.transaction(async (manager) => {
      const supplier = await manager
        .getRepository(Supplier)
        .findOne({ where: { id: String(dto.supplierId) } });
      if (!supplier) {
        throw new NotFoundException(`Supplier ${dto.supplierId} not found`);
      }
      const grnNo = await this.nextGrnNo(manager, dto.receivedDate);
      const grn = await manager.getRepository(Grn).save(
        manager.getRepository(Grn).create({
          grnNo,
          supplierId: String(dto.supplierId),
          invoiceNo: dto.invoiceNo ?? null,
          invoiceDate: dto.invoiceDate ?? null,
          receivedDate: dto.receivedDate,
          status: GrnStatus.DRAFT,
          notes: dto.notes ?? null,
          createdByUserId: actor.userId,
        }),
      );
      await this.auditService.record({
        entityName: 'Grn',
        entityId: grn.id,
        action: AuditAction.CREATE,
        user: actor,
      });
      return grn;
    });
  }

  async setItems(
    id: string,
    dto: SetGrnItemsDto,
    actor: AuthenticatedUser,
  ): Promise<{ items: GrnItem[] }> {
    return this.ds.transaction(async (manager) => {
      const grn = await manager.getRepository(Grn).findOne({ where: { id } });
      if (!grn) throw new NotFoundException(`GRN ${id} not found`);
      if (grn.status !== GrnStatus.DRAFT) {
        throw new BadRequestException('Only DRAFT GRNs can be edited');
      }
      const drugIds = [...new Set(dto.items.map((i) => String(i.drugId)))];
      if (drugIds.length) {
        const found = await manager
          .getRepository(Drug)
          .createQueryBuilder('d')
          .where('d.id IN (:...ids)', { ids: drugIds })
          .getCount();
        if (found !== drugIds.length) {
          throw new BadRequestException('One or more drugIds are invalid');
        }
      }
      await manager.getRepository(GrnItem).delete({ grnId: id });
      const rows = dto.items.map((i) => {
        const base = lineTotalPaise(i);
        return manager.getRepository(GrnItem).create({
          grnId: id,
          drugId: String(i.drugId),
          batchNo: i.batchNo,
          expiryDate: i.expiryDate,
          quantity: i.quantity,
          freeQuantity: i.freeQuantity ?? '0',
          purchasePrice: i.purchasePrice,
          mrp: i.mrp,
          gstRate: i.gstRate ?? '0',
          lineTotal: fromPaise(base + gstPaise(base, i.gstRate ?? '0')),
        });
      });
      const items = await manager.getRepository(GrnItem).save(rows);
      await this.auditService.record({
        entityName: 'Grn',
        entityId: id,
        action: AuditAction.UPDATE,
        user: actor,
        reason: `${items.length} line(s) set`,
      });
      return { items };
    });
  }

  /** Post a DRAFT GRN: create/top-up batches, GRN_IN movements, roll totals,
   * bump the supplier payable, update drug MRP/cost to the latest receipt. */
  async post(id: string, actor: AuthenticatedUser): Promise<Grn> {
    return this.ds.transaction(async (manager) => {
      const grn = await manager
        .getRepository(Grn)
        .createQueryBuilder('g')
        .setLock('pessimistic_write')
        .where('g.id = :id', { id })
        .getOne();
      if (!grn) throw new NotFoundException(`GRN ${id} not found`);
      if (grn.status !== GrnStatus.DRAFT) {
        throw new BadRequestException('Only DRAFT GRNs can be posted');
      }
      const items = await manager
        .getRepository(GrnItem)
        .find({ where: { grnId: id } });
      if (!items.length) {
        throw new BadRequestException('GRN has no items');
      }

      let subtotalPaise = 0n;
      let gstAmountPaise = 0n;

      for (const it of items) {
        const qtyReceived = addMoney(it.quantity, it.freeQuantity);
        const base = (toPaise(it.quantity) * toPaise(it.purchasePrice)) / 100n;
        subtotalPaise += base;
        gstAmountPaise += gstPaise(base, it.gstRate);

        // upsert batch on (drugId, batchNo, expiryDate)
        const batchRepo = manager.getRepository(DrugBatch);
        let batch = await batchRepo
          .createQueryBuilder('b')
          .setLock('pessimistic_write')
          .where(
            'b.drugId = :d AND b.batchNo = :bn AND b.expiryDate = :ex',
            { d: it.drugId, bn: it.batchNo, ex: it.expiryDate },
          )
          .getOne();
        if (batch) {
          batch.quantityReceived = addMoney(
            batch.quantityReceived,
            qtyReceived,
          );
          batch.mrp = it.mrp;
          batch.purchasePrice = it.purchasePrice;
          batch.grnId = grn.id;
          batch.supplierId = grn.supplierId;
          batch.receivedDate = grn.receivedDate;
          batch = await batchRepo.save(batch);
        } else {
          batch = await batchRepo.save(
            batchRepo.create({
              drugId: it.drugId,
              batchNo: it.batchNo,
              expiryDate: it.expiryDate,
              mrp: it.mrp,
              purchasePrice: it.purchasePrice,
              quantityReceived: qtyReceived,
              quantityOnHand: '0',
              grnId: grn.id,
              supplierId: grn.supplierId,
              receivedDate: grn.receivedDate,
            }),
          );
        }

        await this.stock.applyMovement(manager, {
          drugId: it.drugId,
          batchId: batch.id,
          kind: PharmacyMovementKind.GRN_IN,
          signedQty: qtyReceived,
          movementDate: grn.receivedDate,
          refType: 'GRN',
          refId: grn.id,
          actorUserId: actor.userId,
        });

        await manager.getRepository(Drug).update(it.drugId, {
          mrp: it.mrp,
          purchasePrice: it.purchasePrice,
        });
      }

      const totalPaise = subtotalPaise + gstAmountPaise;
      grn.subtotal = fromPaise(subtotalPaise);
      grn.gstAmount = fromPaise(gstAmountPaise);
      grn.total = fromPaise(totalPaise);
      grn.status = GrnStatus.POSTED;
      grn.postedByUserId = actor.userId;
      const saved = await manager.getRepository(Grn).save(grn);

      const supplier = await manager
        .getRepository(Supplier)
        .createQueryBuilder('s')
        .setLock('pessimistic_write')
        .where('s.id = :id', { id: grn.supplierId })
        .getOne();
      if (supplier) {
        await manager.getRepository(Supplier).update(supplier.id, {
          outstandingPayable: addMoney(
            supplier.outstandingPayable,
            grn.total,
          ),
        });
      }

      await this.auditService.record({
        entityName: 'Grn',
        entityId: id,
        action: AuditAction.UPDATE,
        user: actor,
        reason: `Posted; total ${grn.total}`,
      });
      return saved;
    });
  }

  async cancel(id: string, actor: AuthenticatedUser): Promise<Grn> {
    const repo = this.ds.getRepository(Grn);
    const grn = await repo.findOne({ where: { id } });
    if (!grn) throw new NotFoundException(`GRN ${id} not found`);
    if (grn.status !== GrnStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT GRNs can be cancelled');
    }
    grn.status = GrnStatus.CANCELLED;
    const saved = await repo.save(grn);
    await this.auditService.record({
      entityName: 'Grn',
      entityId: id,
      action: AuditAction.UPDATE,
      user: actor,
      reason: 'Cancelled',
    });
    return saved;
  }
}
