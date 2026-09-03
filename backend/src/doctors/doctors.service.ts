import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Doctor } from './entities/doctor.entity';
import {
  CreateDoctorDto,
  QueryDoctorsDto,
  UpdateDoctorDto,
} from './dto/doctor.dto';
import { Paginated } from '../common/dto/pagination';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { diffFields } from '../common/utils/diff.util';
import { toBooleanFulltextQuery } from '../common/utils/fulltext.util';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

const EQ_FILTERS = ['speciality', 'city', 'territory', 'status'] as const;

@Injectable()
export class DoctorsService {
  constructor(
    @InjectRepository(Doctor)
    private readonly repo: Repository<Doctor>,
    private readonly auditService: AuditService,
  ) {}

  async findPage(query: QueryDoctorsDto): Promise<Paginated<Doctor>> {
    const limit = query.limit ?? 50;
    const qb = this.repo.createQueryBuilder('d');
    this.applyFilters(qb, query);

    const hasFilter =
      !!query.q ||
      EQ_FILTERS.some((f) => query[f] !== undefined && query[f] !== '');
    let total: number | null = null;
    if (hasFilter) total = await qb.clone().getCount();

    qb.orderBy('d.id', 'DESC').take(limit);
    if (query.cursor) qb.andWhere('d.id < :cursor', { cursor: query.cursor });
    else if (query.page && query.page > 1) qb.skip((query.page - 1) * limit);

    const rows = await qb.getMany();
    const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;
    return { rows, nextCursor, total, limit };
  }

  private applyFilters(
    qb: SelectQueryBuilder<Doctor>,
    query: QueryDoctorsDto,
  ): void {
    for (const field of EQ_FILTERS) {
      const value = query[field];
      if (value !== undefined && value !== '') {
        qb.andWhere(`d.${field} = :${field}`, { [field]: value });
      }
    }
    if (query.q) {
      const booleanQuery = toBooleanFulltextQuery(query.q);
      if (booleanQuery) {
        qb.andWhere('MATCH(d.name) AGAINST (:ftq IN BOOLEAN MODE)', {
          ftq: booleanQuery,
        });
      } else {
        qb.andWhere('d.name LIKE :likeq', { likeq: `${query.q.trim()}%` });
      }
    }
  }

  async findById(id: string): Promise<Doctor> {
    const doctor = await this.repo.findOne({ where: { id } });
    if (!doctor) throw new NotFoundException(`Doctor ${id} not found`);
    return doctor;
  }

  async create(
    dto: CreateDoctorDto,
    actor: AuthenticatedUser,
  ): Promise<Doctor> {
    const existing = await this.repo.findOne({
      where: { code: dto.code },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException(
        `A doctor with code ${dto.code} already exists`,
      );
    }
    const doctor = this.repo.create({
      ...dto,
      linkedCustomerId:
        dto.linkedCustomerId !== undefined
          ? String(dto.linkedCustomerId)
          : null,
      createdByUserId: actor.userId,
    });
    const saved = await this.repo.save(doctor);
    await this.auditService.record({
      entityName: 'Doctor',
      entityId: saved.id,
      action: AuditAction.CREATE,
      user: actor,
    });
    return saved;
  }

  async update(
    id: string,
    dto: UpdateDoctorDto,
    actor: AuthenticatedUser,
  ): Promise<Doctor> {
    const doctor = await this.findById(id);
    const patch: Record<string, unknown> = { ...dto };
    if (dto.linkedCustomerId !== undefined) {
      patch.linkedCustomerId = String(dto.linkedCustomerId);
    }
    const changes = diffFields(
      doctor as unknown as Record<string, unknown>,
      patch,
    );
    if (Object.keys(changes).length === 0) return doctor;

    Object.assign(doctor, patch);
    const saved = await this.repo.save(doctor);
    await this.auditService.record({
      entityName: 'Doctor',
      entityId: saved.id,
      action: AuditAction.UPDATE,
      user: actor,
      changes,
    });
    return saved;
  }

  async softRemove(id: string, actor: AuthenticatedUser): Promise<void> {
    const doctor = await this.findById(id);
    await this.repo.softRemove(doctor);
    await this.auditService.record({
      entityName: 'Doctor',
      entityId: id,
      action: AuditAction.DELETE,
      user: actor,
    });
  }

  async search(term: string, limit = 10): Promise<Doctor[]> {
    const result = await this.findPage({ q: term, limit } as QueryDoctorsDto);
    return result.rows;
  }
}
