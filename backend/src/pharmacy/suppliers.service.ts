import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { SupplierPayment } from './entities/supplier-payment.entity';
import {
  CreateSupplierDto,
  QuerySuppliersDto,
  SupplierPaymentDto,
  UpdateSupplierDto,
} from './pharmacy.dto';
import { Paginated } from '../common/dto/pagination';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { diffFields } from '../common/utils/diff.util';
import { addMoney, fromPaise, toPaise } from '../common/utils/money.util';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly repo: Repository<Supplier>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async findPage(query: QuerySuppliersDto): Promise<Paginated<Supplier>> {
    const limit = query.limit ?? 50;
    const qb = this.repo.createQueryBuilder('s');
    if (query.isActive !== undefined && query.isActive !== '') {
      qb.andWhere('s.isActive = :active', {
        active: query.isActive === 'true' || query.isActive === '1',
      });
    }
    if (query.q) {
      qb.andWhere('(s.name LIKE :likeq OR s.code LIKE :likeq)', {
        likeq: `${query.q.trim()}%`,
      });
    }
    const total = await qb.clone().getCount();

    qb.orderBy('s.id', 'DESC').take(limit);
    if (query.cursor) {
      qb.andWhere('s.id < :cursor', { cursor: query.cursor });
    } else if (query.page && query.page > 1) {
      qb.skip((query.page - 1) * limit);
    }
    const rows = await qb.getMany();
    const nextCursor =
      rows.length === limit ? rows[rows.length - 1].id : null;
    return { rows, nextCursor, total, limit };
  }

  async findById(id: string): Promise<Supplier> {
    const supplier = await this.repo.findOne({ where: { id } });
    if (!supplier) throw new NotFoundException(`Supplier ${id} not found`);
    return supplier;
  }

  async create(
    dto: CreateSupplierDto,
    actor: AuthenticatedUser,
  ): Promise<Supplier> {
    const existing = await this.repo.findOne({
      where: { code: dto.code },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException(
        `A supplier with code ${dto.code} already exists`,
      );
    }
    const supplier = this.repo.create({
      ...dto,
      outstandingPayable: '0',
      createdByUserId: actor.userId,
    });
    const saved = await this.repo.save(supplier);
    await this.auditService.record({
      entityName: 'Supplier',
      entityId: saved.id,
      action: AuditAction.CREATE,
      user: actor,
    });
    return saved;
  }

  async update(
    id: string,
    dto: UpdateSupplierDto,
    actor: AuthenticatedUser,
  ): Promise<Supplier> {
    const supplier = await this.findById(id);
    const changes = diffFields(
      supplier as unknown as Record<string, unknown>,
      dto as Record<string, unknown>,
    );
    if (Object.keys(changes).length === 0) return supplier;
    Object.assign(supplier, dto);
    const saved = await this.repo.save(supplier);
    await this.auditService.record({
      entityName: 'Supplier',
      entityId: saved.id,
      action: AuditAction.UPDATE,
      user: actor,
      changes,
    });
    return saved;
  }

  payments(supplierId: string): Promise<SupplierPayment[]> {
    return this.dataSource.getRepository(SupplierPayment).find({
      where: { supplierId },
      order: { paidAt: 'DESC', id: 'DESC' },
      take: 200,
    });
  }

  /** Record a payment to a supplier; reduce the denormalised payable (row-locked). */
  async addPayment(
    supplierId: string,
    dto: SupplierPaymentDto,
    actor: AuthenticatedUser,
  ): Promise<SupplierPayment> {
    return this.dataSource.transaction(async (manager) => {
      const supplier = await manager
        .getRepository(Supplier)
        .createQueryBuilder('s')
        .setLock('pessimistic_write')
        .where('s.id = :id', { id: supplierId })
        .getOne();
      if (!supplier) {
        throw new NotFoundException(`Supplier ${supplierId} not found`);
      }
      const payment = await manager.getRepository(SupplierPayment).save(
        manager.getRepository(SupplierPayment).create({
          supplierId,
          amount: dto.amount,
          method: dto.method ?? null,
          reference: dto.reference ?? null,
          paidAt: dto.paidAt,
          notes: dto.notes ?? null,
          createdByUserId: actor.userId,
        }),
      );
      await manager.getRepository(Supplier).update(supplierId, {
        outstandingPayable: addMoney(supplier.outstandingPayable, `-${dto.amount}`),
      });
      await this.auditService.record({
        entityName: 'Supplier',
        entityId: supplierId,
        action: AuditAction.UPDATE,
        user: actor,
        reason: `Payment ${dto.amount} recorded`,
      });
      return payment;
    });
  }

  /** Rebuild one supplier's payable = Σ posted GRN totals − Σ payments. */
  async recomputePayable(
    supplierId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const runner = manager ?? this.dataSource.manager;
    await runner.query(
      `UPDATE suppliers s
         SET s.outstandingPayable = (
           COALESCE((SELECT SUM(g.total) FROM grns g
                     WHERE g.supplierId = s.id AND g.status = 'POSTED'), 0)
           - COALESCE((SELECT SUM(p.amount) FROM supplier_payments p
                       WHERE p.supplierId = s.id), 0)
         )
       WHERE s.id = ?`,
      [supplierId],
    );
  }
}
