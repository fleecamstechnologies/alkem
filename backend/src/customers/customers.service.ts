import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { Paginated } from '../common/dto/pagination';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { diffFields } from '../common/utils/diff.util';
import { toBooleanFulltextQuery } from '../common/utils/fulltext.util';
import { BALANCE_AFFECTING_STATUSES } from '../common/enums/payment.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

const EQ_FILTERS = ['type', 'status', 'city', 'state', 'territory', 'assignedRepId'] as const;

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly repo: Repository<Customer>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  /** Paginated + filtered list. Keyset when `cursor` is set, else capped offset. */
  async findPage(query: QueryCustomersDto): Promise<Paginated<Customer>> {
    const limit = query.limit ?? 50;
    const qb = this.repo.createQueryBuilder('c');

    this.applyFilters(qb, query);

    const hasFilter =
      !!query.q || EQ_FILTERS.some((f) => query[f] !== undefined && query[f] !== '');

    let total: number | null = null;
    if (hasFilter) {
      total = await qb.clone().getCount();
    }

    qb.orderBy('c.id', 'DESC').take(limit);

    if (query.cursor) {
      qb.andWhere('c.id < :cursor', { cursor: query.cursor });
    } else if (query.page && query.page > 1) {
      qb.skip((query.page - 1) * limit);
    }

    const rows = await qb.getMany();
    const nextCursor =
      rows.length === limit ? rows[rows.length - 1].id : null;

    return { rows, nextCursor, total, limit };
  }

  private applyFilters(
    qb: SelectQueryBuilder<Customer>,
    query: QueryCustomersDto,
  ): void {
    for (const field of EQ_FILTERS) {
      const value = query[field];
      if (value !== undefined && value !== '') {
        qb.andWhere(`c.${field} = :${field}`, { [field]: value });
      }
    }

    if (query.q) {
      const booleanQuery = toBooleanFulltextQuery(query.q);
      if (booleanQuery) {
        qb.andWhere(
          'MATCH(c.name) AGAINST (:ftq IN BOOLEAN MODE)',
          { ftq: booleanQuery },
        );
      } else {
        // Tokens too short for the FULLTEXT index — fall back to a prefix LIKE.
        qb.andWhere('c.name LIKE :likeq', { likeq: `${query.q.trim()}%` });
      }
    }
  }

  async findById(id: string): Promise<Customer> {
    const customer = await this.repo.findOne({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return customer;
  }

  async findByCode(code: string): Promise<Customer | null> {
    return this.repo.findOne({ where: { code } });
  }

  async create(
    dto: CreateCustomerDto,
    actor: AuthenticatedUser,
  ): Promise<Customer> {
    const existing = await this.repo.findOne({
      where: { code: dto.code },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException(
        `A customer with code ${dto.code} already exists`,
      );
    }

    const customer = this.repo.create({
      ...dto,
      creditLimit: dto.creditLimit ?? '0',
      outstandingBalance: '0',
      createdByUserId: actor.userId,
    });
    const saved = await this.repo.save(customer);

    await this.auditService.record({
      entityName: 'Customer',
      entityId: saved.id,
      action: AuditAction.CREATE,
      user: actor,
    });

    return saved;
  }

  async update(
    id: string,
    dto: UpdateCustomerDto,
    actor: AuthenticatedUser,
  ): Promise<Customer> {
    const customer = await this.findById(id);
    const changes = diffFields(
      customer as unknown as Record<string, unknown>,
      dto as Record<string, unknown>,
    );
    if (Object.keys(changes).length === 0) {
      return customer;
    }

    Object.assign(customer, dto);
    const saved = await this.repo.save(customer);

    await this.auditService.record({
      entityName: 'Customer',
      entityId: saved.id,
      action: AuditAction.UPDATE,
      user: actor,
      changes,
    });

    return saved;
  }

  async softRemove(id: string, actor: AuthenticatedUser): Promise<void> {
    const customer = await this.findById(id);
    await this.repo.softRemove(customer);
    await this.auditService.record({
      entityName: 'Customer',
      entityId: id,
      action: AuditAction.DELETE,
      user: actor,
    });
  }

  /**
   * Recompute one customer's denormalised outstanding balance from the payment
   * ledger. Cheap — hits the (customerId, ...) index. Runs inside the caller's
   * transaction when a manager is supplied.
   */
  async recomputeOutstanding(
    customerId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const runner = manager ?? this.dataSource.manager;
    await runner.query(
      `UPDATE customers c
         SET c.outstandingBalance = (
           SELECT COALESCE(
             SUM(CASE WHEN p.kind IN ('INVOICE','ADJUSTMENT') THEN p.amount ELSE -p.amount END),
             0)
           FROM payments p
           WHERE p.customerId = c.id AND p.status IN (?, ?)
         )
       WHERE c.id = ?`,
      [...BALANCE_AFFECTING_STATUSES, customerId],
    );
  }

  /** Recompute balances for a specific set of customers (chunked). */
  async recomputeOutstandingForIds(
    ids: string[],
    manager?: EntityManager,
  ): Promise<void> {
    const runner = manager ?? this.dataSource.manager;
    const unique = [...new Set(ids)];
    const CHUNK = 1000;
    for (let i = 0; i < unique.length; i += CHUNK) {
      const slice = unique.slice(i, i + CHUNK);
      const placeholders = slice.map(() => '?').join(',');
      await runner.query(
        `UPDATE customers c
           LEFT JOIN (
             SELECT p.customerId AS cid,
                    SUM(CASE WHEN p.kind IN ('INVOICE','ADJUSTMENT') THEN p.amount ELSE -p.amount END) AS bal
             FROM payments p
             WHERE p.status IN (?, ?) AND p.customerId IN (${placeholders})
             GROUP BY p.customerId
           ) t ON t.cid = c.id
           SET c.outstandingBalance = COALESCE(t.bal, 0)
           WHERE c.id IN (${placeholders})`,
        [...BALANCE_AFFECTING_STATUSES, ...slice, ...slice],
      );
    }
  }

  /** Bulk recompute every balance in one statement. Used after imports. */
  async recomputeAllOutstanding(manager?: EntityManager): Promise<void> {
    const runner = manager ?? this.dataSource.manager;
    await runner.query(
      `UPDATE customers c
         LEFT JOIN (
           SELECT p.customerId AS cid,
                  SUM(CASE WHEN p.kind IN ('INVOICE','ADJUSTMENT') THEN p.amount ELSE -p.amount END) AS bal
           FROM payments p
           WHERE p.status IN (?, ?)
           GROUP BY p.customerId
         ) t ON t.cid = c.id
         SET c.outstandingBalance = COALESCE(t.bal, 0)`,
      [...BALANCE_AFFECTING_STATUSES],
    );
  }

  /** Small helper for customer pickers / autocomplete. */
  async search(term: string, limit = 10): Promise<Customer[]> {
    const result = await this.findPage({
      q: term,
      limit,
    } as QueryCustomersDto);
    return result.rows;
  }
}
