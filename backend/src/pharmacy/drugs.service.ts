import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Drug } from './entities/drug.entity';
import { DrugBatch } from './entities/drug-batch.entity';
import { PrescriptionItem } from '../patients/entities/prescription-item.entity';
import { Prescription } from '../patients/entities/prescription.entity';
import {
  CreateDrugDto,
  QueryDrugsDto,
  UpdateDrugDto,
} from './pharmacy.dto';
import { Paginated } from '../common/dto/pagination';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { diffFields } from '../common/utils/diff.util';
import { toBooleanFulltextQuery } from '../common/utils/fulltext.util';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class DrugsService {
  constructor(
    @InjectRepository(Drug)
    private readonly repo: Repository<Drug>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async findPage(query: QueryDrugsDto): Promise<Paginated<Drug>> {
    const limit = query.limit ?? 50;
    const qb = this.repo.createQueryBuilder('d');
    this.applyFilters(qb, query);

    const hasFilter =
      !!query.q ||
      query.form !== undefined ||
      (query.isActive !== undefined && query.isActive !== '');

    let total: number | null = null;
    if (hasFilter) total = await qb.clone().getCount();

    qb.orderBy('d.id', 'DESC').take(limit);
    if (query.cursor) {
      qb.andWhere('d.id < :cursor', { cursor: query.cursor });
    } else if (query.page && query.page > 1) {
      qb.skip((query.page - 1) * limit);
    }

    const rows = await qb.getMany();
    const nextCursor =
      rows.length === limit ? rows[rows.length - 1].id : null;
    return { rows, nextCursor, total, limit };
  }

  private applyFilters(
    qb: SelectQueryBuilder<Drug>,
    query: QueryDrugsDto,
  ): void {
    if (query.form) qb.andWhere('d.form = :form', { form: query.form });
    if (query.isActive !== undefined && query.isActive !== '') {
      qb.andWhere('d.isActive = :active', {
        active: query.isActive === 'true' || query.isActive === '1',
      });
    }
    if (query.q) {
      const booleanQuery = toBooleanFulltextQuery(query.q);
      if (booleanQuery) {
        qb.andWhere('MATCH(d.name) AGAINST (:ftq IN BOOLEAN MODE)', {
          ftq: booleanQuery,
        });
      } else {
        qb.andWhere('(d.name LIKE :likeq OR d.code LIKE :likeq)', {
          likeq: `${query.q.trim()}%`,
        });
      }
    }
  }

  /** Drug list joined with total on-hand across batches + a reorder flag. */
  async listWithStock(query: QueryDrugsDto) {
    const limit = query.limit ?? 50;
    const whereParams: unknown[] = [];
    const where: string[] = ['1=1'];

    if (query.form) {
      where.push('d.form = ?');
      whereParams.push(query.form);
    }
    if (query.isActive !== undefined && query.isActive !== '') {
      where.push('d.isActive = ?');
      whereParams.push(
        query.isActive === 'true' || query.isActive === '1' ? 1 : 0,
      );
    }
    if (query.q) {
      where.push('(d.name LIKE ? OR d.code LIKE ?)');
      whereParams.push(`%${query.q.trim()}%`, `${query.q.trim()}%`);
    }
    const whereSql = where.join(' AND ');
    const offset = query.page && query.page > 1 ? (query.page - 1) * limit : 0;

    const [countRow] = await this.dataSource.query(
      `SELECT COUNT(*) AS c FROM drugs d WHERE ${whereSql}`,
      whereParams,
    );
    const total = Number(countRow?.c ?? 0);

    const rows = await this.dataSource.query(
      `SELECT d.id, d.code, d.name, d.genericName, d.form, d.strength, d.unit,
              d.mrp, d.purchasePrice, d.reorderLevel, d.rackLocation, d.isActive,
              COALESCE(b.onHand, 0) AS onHand,
              COALESCE(b.batchCount, 0) AS batchCount,
              COALESCE(b.stockValue, 0) AS stockValue,
              (COALESCE(b.onHand, 0) <= d.reorderLevel) AS lowStock
       FROM drugs d
       LEFT JOIN (
         SELECT drugId,
                SUM(quantityOnHand) AS onHand,
                SUM(CASE WHEN quantityOnHand > 0 THEN 1 ELSE 0 END) AS batchCount,
                SUM(quantityOnHand * purchasePrice) AS stockValue
         FROM drug_batches
         GROUP BY drugId
       ) b ON b.drugId = d.id
       WHERE ${whereSql}
       ORDER BY d.name ASC
       LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset],
    );
    return { rows, nextCursor: null, total, limit };
  }

  async findById(id: string): Promise<Drug> {
    const drug = await this.repo.findOne({ where: { id } });
    if (!drug) throw new NotFoundException(`Drug ${id} not found`);
    return drug;
  }

  async create(
    dto: CreateDrugDto,
    actor: AuthenticatedUser,
  ): Promise<Drug> {
    const existing = await this.repo.findOne({
      where: { code: dto.code },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException(`A drug with code ${dto.code} already exists`);
    }
    const drug = this.repo.create({
      ...dto,
      gstRate: dto.gstRate ?? '0',
      mrp: dto.mrp ?? '0',
      purchasePrice: dto.purchasePrice ?? '0',
      createdByUserId: actor.userId,
    });
    const saved = await this.repo.save(drug);
    await this.auditService.record({
      entityName: 'Drug',
      entityId: saved.id,
      action: AuditAction.CREATE,
      user: actor,
    });
    return saved;
  }

  async update(
    id: string,
    dto: UpdateDrugDto,
    actor: AuthenticatedUser,
  ): Promise<Drug> {
    const drug = await this.findById(id);
    const changes = diffFields(
      drug as unknown as Record<string, unknown>,
      dto as Record<string, unknown>,
    );
    if (Object.keys(changes).length === 0) return drug;
    Object.assign(drug, dto);
    const saved = await this.repo.save(drug);
    await this.auditService.record({
      entityName: 'Drug',
      entityId: saved.id,
      action: AuditAction.UPDATE,
      user: actor,
      changes,
    });
    return saved;
  }

  async softRemove(id: string, actor: AuthenticatedUser): Promise<void> {
    const drug = await this.findById(id);
    await this.repo.softRemove(drug);
    await this.auditService.record({
      entityName: 'Drug',
      entityId: id,
      action: AuditAction.DELETE,
      user: actor,
    });
  }

  async search(term: string, limit = 10): Promise<Drug[]> {
    const result = await this.findPage({
      q: term,
      limit,
      isActive: 'true',
    } as QueryDrugsDto);
    return result.rows;
  }

  batches(drugId: string): Promise<DrugBatch[]> {
    return this.dataSource.getRepository(DrugBatch).find({
      where: { drugId },
      order: { expiryDate: 'ASC' },
    });
  }

  async movements(drugId: string, from?: string, to?: string) {
    const where = ['m.drugId = ?'];
    const args: unknown[] = [drugId];
    if (from) {
      where.push('m.movementDate >= ?');
      args.push(from);
    }
    if (to) {
      where.push('m.movementDate <= ?');
      args.push(to);
    }
    return this.dataSource.query(
      `SELECT m.id, m.batchId, b.batchNo, DATE_FORMAT(b.expiryDate,'%Y-%m-%d') AS expiryDate,
              m.kind, m.qty, DATE_FORMAT(m.movementDate,'%Y-%m-%d') AS movementDate,
              m.refType, m.refId, m.note
       FROM pharmacy_stock_movements m
       LEFT JOIN drug_batches b ON b.id = m.batchId
       WHERE ${where.join(' AND ')}
       ORDER BY m.movementDate DESC, m.id DESC
       LIMIT 500`,
      args,
    );
  }

  /** Prefill helper: the prescription's medicine lines, each fuzzy-matched to a
   * drug in the master by name (best-effort — pharmacist confirms). */
  async getPrescriptionItems(rxId: string) {
    const rx = await this.dataSource
      .getRepository(Prescription)
      .findOne({ where: { id: rxId } });
    if (!rx) throw new NotFoundException(`Prescription ${rxId} not found`);

    const items = await this.dataSource
      .getRepository(PrescriptionItem)
      .find({ where: { prescriptionId: rxId } });

    const out: Array<{
      prescriptionItemId: string;
      drugName: string;
      strength: string | null;
      dosage: string | null;
      quantity: string | null;
      matchedDrugId: string | null;
      matchedDrugName: string | null;
      matchedMrp: string | null;
    }> = [];
    for (const it of items) {
      const match = await this.repo
        .createQueryBuilder('d')
        .where('d.isActive = 1')
        .andWhere('(d.name LIKE :n OR d.genericName LIKE :n)', {
          n: `${it.drugName.split(' ')[0]}%`,
        })
        .orderBy('d.name', 'ASC')
        .limit(1)
        .getOne();
      out.push({
        prescriptionItemId: it.id,
        drugName: it.drugName,
        strength: it.strength,
        dosage: it.dosage,
        quantity: it.quantity,
        matchedDrugId: match?.id ?? null,
        matchedDrugName: match?.name ?? null,
        matchedMrp: match?.mrp ?? null,
      });
    }
    return { prescriptionId: rxId, patientId: rx.patientId, items: out };
  }
}
