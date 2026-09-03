import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Customer } from '../customers/entities/customer.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { SummaryQueryDto } from './dto/summary-query.dto';
import { Paginated } from '../common/dto/pagination';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { fromPaise, toPaise } from '../common/utils/money.util';
import {
  BALANCE_AFFECTING_STATUSES,
  balanceSign,
  PaymentKind,
  PaymentStatus,
} from '../common/enums/payment.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

function affects(status: PaymentStatus): boolean {
  return BALANCE_AFFECTING_STATUSES.includes(status);
}

/** Signed change this ledger entry applies to the customer balance, in paise. */
function deltaPaise(kind: PaymentKind, amount: string): bigint {
  return toPaise(amount) * BigInt(balanceSign(kind));
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly repo: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async create(
    dto: CreatePaymentDto,
    actor: AuthenticatedUser,
  ): Promise<Payment> {
    if (toPaise(dto.amount) < 0n && dto.kind !== PaymentKind.ADJUSTMENT) {
      throw new BadRequestException(
        'Only ADJUSTMENT entries may carry a negative amount',
      );
    }
    const status = dto.status ?? PaymentStatus.CLEARED;

    return this.dataSource.transaction(async (manager) => {
      // Lock the customer row so concurrent payments can't lose a balance update.
      const customer = await manager
        .getRepository(Customer)
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id: String(dto.customerId) })
        .getOne();
      if (!customer) {
        throw new NotFoundException(`Customer ${dto.customerId} not found`);
      }

      const payment = manager.getRepository(Payment).create({
        customerId: String(dto.customerId),
        kind: dto.kind,
        amount: dto.amount,
        method: dto.method ?? null,
        referenceNo: dto.referenceNo ?? null,
        paymentDate: dto.paymentDate,
        status,
        notes: dto.notes ?? null,
        createdByUserId: actor.userId,
      });
      const saved = await manager.getRepository(Payment).save(payment);

      if (affects(status)) {
        const newBalance = fromPaise(
          toPaise(customer.outstandingBalance) +
            deltaPaise(dto.kind, dto.amount),
        );
        await manager
          .getRepository(Customer)
          .update(customer.id, { outstandingBalance: newBalance });
      }

      await this.auditService.record({
        entityName: 'Payment',
        entityId: saved.id,
        action: AuditAction.CREATE,
        user: actor,
      });

      return saved;
    });
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    actor: AuthenticatedUser,
  ): Promise<Payment> {
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager
        .getRepository(Payment)
        .findOne({ where: { id } });
      if (!payment) {
        throw new NotFoundException(`Payment ${id} not found`);
      }
      if (payment.status === status) {
        return payment;
      }

      const customer = await manager
        .getRepository(Customer)
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id: payment.customerId })
        .getOne();

      if (customer) {
        const delta = deltaPaise(payment.kind, payment.amount);
        let change = 0n;
        if (affects(payment.status) && !affects(status)) change = -delta;
        if (!affects(payment.status) && affects(status)) change = delta;
        if (change !== 0n) {
          await manager.getRepository(Customer).update(customer.id, {
            outstandingBalance: fromPaise(
              toPaise(customer.outstandingBalance) + change,
            ),
          });
        }
      }

      const previous = payment.status;
      payment.status = status;
      const saved = await manager.getRepository(Payment).save(payment);

      await this.auditService.record({
        entityName: 'Payment',
        entityId: saved.id,
        action: AuditAction.UPDATE,
        user: actor,
        changes: { status: { old: previous, new: status } },
      });

      return saved;
    });
  }

  /** Global payment list with filters. */
  findPage(query: QueryPaymentsDto): Promise<Paginated<Payment>> {
    const qb = this.repo.createQueryBuilder('p');
    if (query.customerId !== undefined) {
      qb.andWhere('p.customerId = :customerId', {
        customerId: String(query.customerId),
      });
    }
    return this.paginate(qb, query);
  }

  /** A single customer's ledger, newest first. */
  listForCustomer(
    customerId: string,
    query: QueryPaymentsDto,
  ): Promise<Paginated<Payment>> {
    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.customerId = :customerId', { customerId });
    return this.paginate(qb, query);
  }

  private async paginate(
    qb: SelectQueryBuilder<Payment>,
    query: QueryPaymentsDto,
  ): Promise<Paginated<Payment>> {
    const limit = query.limit ?? 50;

    if (query.kind) qb.andWhere('p.kind = :kind', { kind: query.kind });
    if (query.method) qb.andWhere('p.method = :method', { method: query.method });
    if (query.status) qb.andWhere('p.status = :status', { status: query.status });
    if (query.from) qb.andWhere('p.paymentDate >= :from', { from: query.from });
    if (query.to) qb.andWhere('p.paymentDate <= :to', { to: query.to });

    const hasFilter =
      !!(query.kind || query.method || query.status || query.from || query.to);
    let total: number | null = null;
    if (hasFilter || query.customerId !== undefined) {
      total = await qb.clone().getCount();
    }

    qb.orderBy('p.paymentDate', 'DESC').addOrderBy('p.id', 'DESC').take(limit);

    if (query.cursor) {
      const [cDate, cId] = query.cursor.split('_');
      qb.andWhere(
        '(p.paymentDate < :cDate OR (p.paymentDate = :cDate AND p.id < :cId))',
        { cDate, cId },
      );
    } else if (query.page && query.page > 1) {
      qb.skip((query.page - 1) * limit);
    }

    const rows = await qb.getMany();
    const last = rows[rows.length - 1];
    const nextCursor =
      rows.length === limit && last ? `${last.paymentDate}_${last.id}` : null;

    return { rows, nextCursor, total, limit };
  }

  /**
   * Running-balance statement for a date range. Opening balance is the sum of
   * all balance-affecting deltas dated before `from`; the running balance then
   * walks forward through the in-range rows.
   */
  async statement(customerId: string, from: string, to: string) {
    const customer = await this.dataSource
      .getRepository(Customer)
      .findOne({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    const openingRow = await this.repo
      .createQueryBuilder('p')
      .select(
        `COALESCE(SUM(CASE WHEN p.kind IN ('INVOICE','ADJUSTMENT') THEN p.amount ELSE -p.amount END), 0)`,
        'bal',
      )
      .where('p.customerId = :customerId', { customerId })
      .andWhere('p.paymentDate < :from', { from })
      .andWhere('p.status IN (:...statuses)', {
        statuses: BALANCE_AFFECTING_STATUSES,
      })
      .getRawOne<{ bal: string }>();

    const rows = await this.repo
      .createQueryBuilder('p')
      .where('p.customerId = :customerId', { customerId })
      .andWhere('p.paymentDate >= :from', { from })
      .andWhere('p.paymentDate <= :to', { to })
      .orderBy('p.paymentDate', 'ASC')
      .addOrderBy('p.id', 'ASC')
      .limit(5000)
      .getMany();

    let running = toPaise(openingRow?.bal ?? '0');
    const lines = rows.map((p) => {
      if (affects(p.status)) {
        running += deltaPaise(p.kind, p.amount);
      }
      return { ...p, runningBalance: fromPaise(running) };
    });

    return {
      customerId,
      customerName: customer.name,
      from,
      to,
      openingBalance: fromPaise(toPaise(openingRow?.bal ?? '0')),
      closingBalance: fromPaise(running),
      currentBalance: customer.outstandingBalance,
      lines,
    };
  }

  /** Period totals bucketed by day or month. Cached for 60s. */
  async periodSummary(query: SummaryQueryDto) {
    const key = `pay:summary:${query.from ?? ''}:${query.to ?? ''}:${query.groupBy}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const fmt = query.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
    const qb = this.repo
      .createQueryBuilder('p')
      .select(`DATE_FORMAT(p.paymentDate, '${fmt}')`, 'bucket')
      .addSelect(
        `SUM(CASE WHEN p.kind = 'INVOICE' THEN p.amount ELSE 0 END)`,
        'invoiced',
      )
      .addSelect(
        `SUM(CASE WHEN p.kind = 'RECEIPT' THEN p.amount ELSE 0 END)`,
        'received',
      )
      .addSelect(
        `SUM(CASE WHEN p.kind = 'CREDIT_NOTE' THEN p.amount ELSE 0 END)`,
        'creditNotes',
      )
      .addSelect('COUNT(*)', 'count')
      .groupBy('bucket')
      .orderBy('bucket', 'ASC');

    if (query.from) qb.andWhere('p.paymentDate >= :from', { from: query.from });
    if (query.to) qb.andWhere('p.paymentDate <= :to', { to: query.to });

    const raw = await qb.getRawMany<{
      bucket: string;
      invoiced: string;
      received: string;
      creditNotes: string;
      count: string;
    }>();
    const result = raw.map((r) => ({
      bucket: r.bucket,
      invoiced: r.invoiced ?? '0.00',
      received: r.received ?? '0.00',
      creditNotes: r.creditNotes ?? '0.00',
      count: Number(r.count),
    }));

    await this.cache.set(key, result, 60_000);
    return result;
  }

  /** Headline numbers for the dashboard. Cached for 60s. */
  async dashboardStats() {
    const key = 'dash:stats';
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const customerRepo = this.dataSource.getRepository(Customer);
    const monthStart = new Date().toISOString().slice(0, 8) + '01';
    const today = new Date().toISOString().slice(0, 10);

    const [
      totalCustomers,
      activeCustomers,
      blockedCustomers,
      outstandingRow,
      invoicedMonth,
      receivedMonth,
      paymentsToday,
      topOutstanding,
    ] = await Promise.all([
      customerRepo.count(),
      customerRepo.count({ where: { status: 'ACTIVE' as never } }),
      customerRepo.count({ where: { status: 'BLOCKED' as never } }),
      customerRepo
        .createQueryBuilder('c')
        .select('COALESCE(SUM(c.outstandingBalance), 0)', 'total')
        .getRawOne<{ total: string }>(),
      this.sumBy('INVOICE', monthStart, today),
      this.sumBy('RECEIPT', monthStart, today),
      this.repo.count({ where: { paymentDate: today } }),
      customerRepo.find({
        order: { outstandingBalance: 'DESC' },
        take: 10,
        select: ['id', 'code', 'name', 'city', 'outstandingBalance'],
      }),
    ]);

    const result = {
      totalCustomers,
      activeCustomers,
      blockedCustomers,
      totalOutstanding: outstandingRow?.total ?? '0.00',
      invoicedThisMonth: invoicedMonth,
      receivedThisMonth: receivedMonth,
      paymentsToday,
      topOutstanding,
    };
    await this.cache.set(key, result, 60_000);
    return result;
  }

  private async sumBy(
    kind: PaymentKind | string,
    from: string,
    to: string,
  ): Promise<string> {
    const row = await this.repo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'total')
      .where('p.kind = :kind', { kind })
      .andWhere('p.paymentDate >= :from', { from })
      .andWhere('p.paymentDate <= :to', { to })
      .andWhere('p.status IN (:...statuses)', {
        statuses: BALANCE_AFFECTING_STATUSES,
      })
      .getRawOne<{ total: string }>();
    return row?.total ?? '0.00';
  }
}
