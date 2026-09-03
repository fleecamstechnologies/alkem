import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EmployeeStatutoryProfile } from './entities/employee-statutory-profile.entity';
import { UpdateEmployeeStatutoryDto } from './dto/statutory.dto';
import { EmployeesService } from '../employees/employees.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { diffFields } from '../common/utils/diff.util';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class EmployeeStatutoryService {
  constructor(
    @InjectRepository(EmployeeStatutoryProfile)
    private readonly repo: Repository<EmployeeStatutoryProfile>,
    private readonly employeesService: EmployeesService,
    private readonly auditService: AuditService,
  ) {}

  private defaultFor(employeeId: string): Partial<EmployeeStatutoryProfile> {
    return {
      employeeId,
      pfApplicable: true,
      pfUsesActualWage: false,
      esiApplicable: null,
      ptStateCode: 'MH',
    };
  }

  /** Fetch (auto-creating a default row on first read). */
  async get(employeeId: string): Promise<EmployeeStatutoryProfile> {
    await this.employeesService.findById(employeeId);
    let row = await this.repo.findOne({ where: { employeeId } });
    if (!row) {
      row = await this.repo.save(this.repo.create(this.defaultFor(employeeId)));
    }
    return row;
  }

  async update(
    employeeId: string,
    dto: UpdateEmployeeStatutoryDto,
    actor: AuthenticatedUser,
  ): Promise<EmployeeStatutoryProfile> {
    const row = await this.get(employeeId);
    const changes = diffFields(
      row as unknown as Record<string, unknown>,
      dto as Record<string, unknown>,
    );
    Object.assign(row, dto);
    if (dto.ptStateCode) row.ptStateCode = dto.ptStateCode.toUpperCase();
    const saved = await this.repo.save(row);
    if (Object.keys(changes).length) {
      await this.auditService.record({
        entityName: 'EmployeeStatutoryProfile',
        entityId: saved.id,
        action: AuditAction.UPDATE,
        user: actor,
        changes,
      });
    }
    return saved;
  }

  /**
   * Bulk-load profiles for a pay run: returns a Map keyed by employeeId, with
   * default rows inserted for any employee that has none yet.
   */
  async ensureProfiles(
    employeeIds: string[],
  ): Promise<Map<string, EmployeeStatutoryProfile>> {
    if (!employeeIds.length) return new Map();
    const existing = await this.repo.find({
      where: { employeeId: In(employeeIds) },
    });
    const byId = new Map(existing.map((p) => [p.employeeId, p]));
    const missing = employeeIds.filter((id) => !byId.has(id));
    if (missing.length) {
      const created = await this.repo.save(
        missing.map((id) => this.repo.create(this.defaultFor(id))),
      );
      for (const p of created) byId.set(p.employeeId, p);
    }
    return byId;
  }

  async requireForEmployee(employeeId: string): Promise<EmployeeStatutoryProfile> {
    const row = await this.repo.findOne({ where: { employeeId } });
    if (!row) throw new NotFoundException(`No statutory profile for ${employeeId}`);
    return row;
  }
}
