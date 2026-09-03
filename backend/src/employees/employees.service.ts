import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { Paginated } from '../common/dto/pagination';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { diffFields } from '../common/utils/diff.util';
import { toBooleanFulltextQuery } from '../common/utils/fulltext.util';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

const EQ_FILTERS = ['departmentId', 'status', 'employmentType', 'designation'] as const;

/** Numeric fields that arrive as numbers on the DTO but are stored as bigint strings. */
const BIGINT_FIELDS = ['departmentId', 'reportingManagerId'] as const;

function normalise(
  dto: CreateEmployeeDto | UpdateEmployeeDto,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...dto };
  for (const f of BIGINT_FIELDS) {
    if (out[f] !== undefined && out[f] !== null) out[f] = String(out[f]);
  }
  return out;
}

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly repo: Repository<Employee>,
    private readonly auditService: AuditService,
  ) {}

  async findPage(query: QueryEmployeesDto): Promise<Paginated<Employee>> {
    const limit = query.limit ?? 50;
    const qb = this.repo.createQueryBuilder('e');
    this.applyFilters(qb, query);

    const hasFilter =
      !!query.q ||
      EQ_FILTERS.some((f) => query[f] !== undefined && query[f] !== '');

    let total: number | null = null;
    if (hasFilter) total = await qb.clone().getCount();

    qb.orderBy('e.id', 'DESC').take(limit);
    if (query.cursor) {
      qb.andWhere('e.id < :cursor', { cursor: query.cursor });
    } else if (query.page && query.page > 1) {
      qb.skip((query.page - 1) * limit);
    }

    const rows = await qb.getMany();
    const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;
    return { rows, nextCursor, total, limit };
  }

  private applyFilters(
    qb: SelectQueryBuilder<Employee>,
    query: QueryEmployeesDto,
  ): void {
    for (const field of EQ_FILTERS) {
      const value = query[field];
      if (value !== undefined && value !== '') {
        qb.andWhere(`e.${field} = :${field}`, { [field]: value });
      }
    }
    if (query.q) {
      const booleanQuery = toBooleanFulltextQuery(query.q);
      if (booleanQuery) {
        qb.andWhere(
          'MATCH(e.firstName, e.lastName) AGAINST (:ftq IN BOOLEAN MODE)',
          { ftq: booleanQuery },
        );
      } else {
        qb.andWhere(
          '(e.firstName LIKE :likeq OR e.lastName LIKE :likeq OR e.code LIKE :likeq)',
          { likeq: `${query.q.trim()}%` },
        );
      }
    }
  }

  async findById(id: string): Promise<Employee> {
    const employee = await this.repo.findOne({ where: { id } });
    if (!employee) throw new NotFoundException(`Employee ${id} not found`);
    return employee;
  }

  async findByCode(code: string): Promise<Employee | null> {
    return this.repo.findOne({ where: { code } });
  }

  async create(
    dto: CreateEmployeeDto,
    actor: AuthenticatedUser,
  ): Promise<Employee> {
    const existing = await this.repo.findOne({
      where: { code: dto.code },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException(
        `An employee with code ${dto.code} already exists`,
      );
    }
    const employee = this.repo.create({
      ...(normalise(dto) as Partial<Employee>),
      ctcAnnual: dto.ctcAnnual ?? '0',
      createdByUserId: actor.userId,
    });
    const saved = await this.repo.save(employee);
    await this.auditService.record({
      entityName: 'Employee',
      entityId: saved.id,
      action: AuditAction.CREATE,
      user: actor,
    });
    return saved;
  }

  async update(
    id: string,
    dto: UpdateEmployeeDto,
    actor: AuthenticatedUser,
  ): Promise<Employee> {
    const employee = await this.findById(id);
    const patch = normalise(dto);
    const changes = diffFields(
      employee as unknown as Record<string, unknown>,
      patch,
    );
    if (Object.keys(changes).length === 0) return employee;

    Object.assign(employee, patch);
    const saved = await this.repo.save(employee);
    await this.auditService.record({
      entityName: 'Employee',
      entityId: saved.id,
      action: AuditAction.UPDATE,
      user: actor,
      changes,
    });
    return saved;
  }

  async softRemove(id: string, actor: AuthenticatedUser): Promise<void> {
    const employee = await this.findById(id);
    await this.repo.softRemove(employee);
    await this.auditService.record({
      entityName: 'Employee',
      entityId: id,
      action: AuditAction.DELETE,
      user: actor,
    });
  }

  async search(term: string, limit = 10): Promise<Employee[]> {
    const result = await this.findPage({
      q: term,
      limit,
    } as QueryEmployeesDto);
    return result.rows;
  }

  /** All ACTIVE employees — used by payroll processing. */
  findActive(): Promise<Employee[]> {
    return this.repo.find({
      where: { status: 'ACTIVE' as Employee['status'] },
      order: { id: 'ASC' },
    });
  }
}
