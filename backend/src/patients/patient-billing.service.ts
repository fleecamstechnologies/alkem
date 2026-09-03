import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PatientCharge } from './entities/patient-charge.entity';
import { Patient } from './entities/patient.entity';
import { CreateChargeDto } from './patients.dto';
import {
  BALANCE_AFFECTING_CHARGE_STATUSES,
  ChargeKind,
  ChargeStatus,
  chargeSign,
} from '../common/enums/patient.enum';
import { fromPaise, toPaise } from '../common/utils/money.util';
import { Paginated, PaginationQuery } from '../common/dto/pagination';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

function affects(status: ChargeStatus): boolean {
  return BALANCE_AFFECTING_CHARGE_STATUSES.includes(status);
}
function deltaPaise(kind: ChargeKind, amount: string): bigint {
  return toPaise(amount) * BigInt(chargeSign(kind));
}

@Injectable()
export class PatientBillingService {
  constructor(
    @InjectRepository(PatientCharge)
    private readonly repo: Repository<PatientCharge>,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async addCharge(
    patientId: string,
    dto: CreateChargeDto,
    actor: AuthenticatedUser,
  ): Promise<PatientCharge> {
    const status = dto.status ?? ChargeStatus.CLEARED;
    return this.dataSource.transaction(async (manager) => {
      const patient = await manager
        .getRepository(Patient)
        .createQueryBuilder('p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id: patientId })
        .getOne();
      if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);

      const charge = await manager.getRepository(PatientCharge).save(
        manager.getRepository(PatientCharge).create({
          patientId,
          kind: dto.kind,
          amount: dto.amount,
          method: dto.method ?? null,
          reference: dto.reference ?? null,
          chargeDate: dto.chargeDate,
          serviceKind: dto.serviceKind ?? null,
          description: dto.description ?? null,
          visitId: dto.visitId != null ? String(dto.visitId) : null,
          status,
          createdByUserId: actor.userId,
        }),
      );

      if (affects(status)) {
        const next = fromPaise(
          toPaise(patient.outstandingBalance) + deltaPaise(dto.kind, dto.amount),
        );
        await manager
          .getRepository(Patient)
          .update(patientId, { outstandingBalance: next });
      }
      await this.cache.del('patbill:dashboard');
      return charge;
    });
  }

  async updateChargeStatus(
    id: string,
    status: ChargeStatus,
  ): Promise<PatientCharge> {
    return this.dataSource.transaction(async (manager) => {
      const charge = await manager
        .getRepository(PatientCharge)
        .findOne({ where: { id } });
      if (!charge) throw new NotFoundException(`Charge ${id} not found`);
      if (charge.status === status) return charge;

      const patient = await manager
        .getRepository(Patient)
        .createQueryBuilder('p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id: charge.patientId })
        .getOne();

      if (patient) {
        const delta = deltaPaise(charge.kind, charge.amount);
        let change = 0n;
        if (affects(charge.status) && !affects(status)) change = -delta;
        if (!affects(charge.status) && affects(status)) change = delta;
        if (change !== 0n) {
          await manager.getRepository(Patient).update(patient.id, {
            outstandingBalance: fromPaise(
              toPaise(patient.outstandingBalance) + change,
            ),
          });
        }
      }
      charge.status = status;
      const saved = await manager.getRepository(PatientCharge).save(charge);
      await this.cache.del('patbill:dashboard');
      return saved;
    });
  }

  listCharges(
    patientId: string,
    query: PaginationQuery,
  ): Promise<Paginated<PatientCharge>> {
    const limit = query.limit ?? 50;
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.patientId = :pid', { pid: patientId })
      .orderBy('c.chargeDate', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .take(limit);
    if (query.cursor) {
      const [d, i] = query.cursor.split('_');
      qb.andWhere('(c.chargeDate < :d OR (c.chargeDate = :d AND c.id < :i))', {
        d,
        i,
      });
    }
    return qb.getMany().then((rows) => {
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor:
          rows.length === limit && last
            ? `${last.chargeDate}_${last.id}`
            : null,
        total: null,
        limit,
      };
    });
  }

  async statement(patientId: string, from: string, to: string) {
    const patient = await this.dataSource
      .getRepository(Patient)
      .findOne({ where: { id: patientId } });
    if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);

    const openingRow = await this.repo
      .createQueryBuilder('c')
      .select(
        `COALESCE(SUM(CASE WHEN c.kind IN ('INVOICE','ADJUSTMENT') THEN c.amount ELSE -c.amount END), 0)`,
        'bal',
      )
      .where('c.patientId = :pid', { pid: patientId })
      .andWhere('c.chargeDate < :from', { from })
      .andWhere('c.status IN (:...st)', { st: BALANCE_AFFECTING_CHARGE_STATUSES })
      .getRawOne<{ bal: string }>();

    const rows = await this.repo
      .createQueryBuilder('c')
      .where('c.patientId = :pid', { pid: patientId })
      .andWhere('c.chargeDate >= :from AND c.chargeDate <= :to', { from, to })
      .orderBy('c.chargeDate', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .limit(5000)
      .getMany();

    let running = toPaise(openingRow?.bal ?? '0');
    const lines = rows.map((c) => {
      if (affects(c.status)) running += deltaPaise(c.kind, c.amount);
      return { ...c, runningBalance: fromPaise(running) };
    });

    return {
      patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      from,
      to,
      openingBalance: fromPaise(toPaise(openingRow?.bal ?? '0')),
      closingBalance: fromPaise(running),
      currentBalance: patient.outstandingBalance,
      lines,
    };
  }

  async dashboard() {
    const cached = await this.cache.get('patbill:dashboard');
    if (cached) return cached;
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 8) + '01';

    const [todayCollected, outstanding, byService] = await Promise.all([
      this.repo
        .createQueryBuilder('c')
        .select('COALESCE(SUM(c.amount), 0)', 'total')
        .where("c.kind = 'PAYMENT' AND c.chargeDate = :d", { d: today })
        .andWhere('c.status IN (:...st)', {
          st: BALANCE_AFFECTING_CHARGE_STATUSES,
        })
        .getRawOne<{ total: string }>(),
      this.dataSource
        .getRepository(Patient)
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.outstandingBalance), 0)', 'total')
        .getRawOne<{ total: string }>(),
      this.dataSource.query(
        `SELECT serviceKind, COALESCE(SUM(amount),0) AS total
         FROM patient_charges
         WHERE kind = 'INVOICE' AND chargeDate >= ? AND chargeDate <= ?
         GROUP BY serviceKind`,
        [monthStart, today],
      ),
    ]);

    const result = {
      date: today,
      todayCollected: todayCollected?.total ?? '0.00',
      totalOutstanding: outstanding?.total ?? '0.00',
      revenueByService: (byService as Array<Record<string, string>>).map((r) => ({
        serviceKind: r.serviceKind ?? 'OTHER',
        total: r.total,
      })),
    };
    await this.cache.set('patbill:dashboard', result, 60_000);
    return result;
  }
}
