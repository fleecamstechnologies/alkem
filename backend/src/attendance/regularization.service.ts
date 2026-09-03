import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AttendanceRegularization } from './entities/attendance-regularization.entity';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { AttendanceEvent } from './entities/attendance-event.entity';
import { SettingsService } from './settings.service';
import {
  CreateRegularizationDto,
  DecideRegularizationDto,
  QueryRegularizationsDto,
} from './dto/punch.dto';
import {
  AttendanceSource,
  AttendanceStatus,
  LeaveRequestStatus,
  PunchType,
} from '../common/enums/attendance.enum';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

const PROTECTED_STATUSES: AttendanceStatus[] = [
  AttendanceStatus.ON_LEAVE,
  AttendanceStatus.HOLIDAY,
  AttendanceStatus.WEEK_OFF,
];

@Injectable()
export class RegularizationService {
  constructor(
    @InjectRepository(AttendanceRegularization)
    private readonly repo: Repository<AttendanceRegularization>,
    private readonly settingsService: SettingsService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  private async withEmployee(rows: AttendanceRegularization[]) {
    if (!rows.length) return rows;
    const ids = [...new Set(rows.map((r) => String(r.employeeId)))];
    const emps: Array<{ id: string; name: string; code: string }> =
      await this.dataSource.query(
        `SELECT id, CONCAT(firstName,' ',lastName) AS name, code
         FROM employees WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids,
      );
    const map = new Map(emps.map((e) => [String(e.id), e]));
    return rows.map(
      (r) =>
        ({
          ...r,
          employeeName: map.get(String(r.employeeId))?.name ?? null,
          employeeCode: map.get(String(r.employeeId))?.code ?? null,
        }) as unknown as AttendanceRegularization,
    );
  }

  listMine(employeeId: string): Promise<AttendanceRegularization[]> {
    return this.repo.find({
      where: { employeeId },
      order: { date: 'DESC', id: 'DESC' },
      take: 100,
    });
  }

  async list(query: QueryRegularizationsDto) {
    const qb = this.repo
      .createQueryBuilder('r')
      .orderBy('r.createdAt', 'DESC')
      .limit(500);
    if (query.status) qb.andWhere('r.status = :s', { s: query.status });
    if (query.employeeId !== undefined) {
      qb.andWhere('r.employeeId = :e', { e: String(query.employeeId) });
    }
    return this.withEmployee(await qb.getMany());
  }

  async approvalsFor(managerEmployeeId: string) {
    const rows: AttendanceRegularization[] = await this.repo
      .createQueryBuilder('r')
      .where('r.status = :p', { p: LeaveRequestStatus.PENDING })
      .andWhere(
        'r.employeeId IN (SELECT id FROM employees WHERE reportingManagerId = :m)',
        { m: managerEmployeeId },
      )
      .orderBy('r.createdAt', 'ASC')
      .getMany();
    return this.withEmployee(rows);
  }

  async request(
    employeeId: string,
    dto: CreateRegularizationDto,
    actor: AuthenticatedUser,
  ): Promise<AttendanceRegularization> {
    const inAt = new Date(dto.inAt.replace(' ', 'T'));
    const outAt = new Date(dto.outAt.replace(' ', 'T'));
    if (outAt <= inAt) {
      throw new BadRequestException('outAt must be after inAt');
    }
    if (dto.date > new Date().toISOString().slice(0, 10)) {
      throw new BadRequestException('cannot regularize a future date');
    }
    const dup = await this.repo.findOne({
      where: {
        employeeId,
        date: dto.date,
        status: LeaveRequestStatus.PENDING,
      },
    });
    if (dup) {
      throw new BadRequestException(
        'a regularization request for this date is already pending',
      );
    }
    return this.repo.save(
      this.repo.create({
        employeeId,
        date: dto.date,
        requestedInAt: inAt,
        requestedOutAt: outAt,
        reason: dto.reason,
        status: LeaveRequestStatus.PENDING,
        createdByUserId: actor.userId,
      }),
    );
  }

  async cancel(
    employeeId: string,
    id: string,
  ): Promise<AttendanceRegularization> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Regularization ${id} not found`);
    if (String(row.employeeId) !== String(employeeId)) {
      throw new BadRequestException('not your request');
    }
    if (row.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException('only pending requests can be cancelled');
    }
    row.status = LeaveRequestStatus.CANCELLED;
    return this.repo.save(row);
  }

  async findById(id: string): Promise<AttendanceRegularization> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Regularization ${id} not found`);
    return row;
  }

  async decide(
    id: string,
    dto: DecideRegularizationDto,
    approver: AuthenticatedUser,
  ): Promise<AttendanceRegularization> {
    const settings = await this.settingsService.get();
    return this.dataSource.transaction(async (manager) => {
      const regRepo = manager.getRepository(AttendanceRegularization);
      const row = await regRepo.findOne({ where: { id } });
      if (!row) throw new NotFoundException(`Regularization ${id} not found`);
      if (row.status !== LeaveRequestStatus.PENDING) {
        throw new BadRequestException(
          `request is already ${row.status.toLowerCase()}`,
        );
      }
      const from = row.status;

      if (dto.decision === LeaveRequestStatus.APPROVED) {
        const inAt = row.requestedInAt!;
        const outAt = row.requestedOutAt!;
        const workedHours = Math.max(
          0,
          (outAt.getTime() - inAt.getTime()) / 3_600_000,
        );
        const meetsHalf = workedHours >= Number(settings.punchHalfDayHours);

        const recRepo = manager.getRepository(AttendanceRecord);
        const existing = await recRepo.findOne({
          where: { employeeId: row.employeeId, date: row.date },
        });
        const protectedRow =
          !!existing && PROTECTED_STATUSES.includes(existing.status);

        const rec = recRepo.create({
          ...existing,
          employeeId: row.employeeId,
          date: row.date,
          firstInAt: inAt,
          lastOutAt: outAt,
          breakMinutes: 0,
          workedHours: workedHours.toFixed(2),
          note: `Regularized: ${row.reason}`.slice(0, 255),
        });
        if (!protectedRow) {
          rec.status = meetsHalf
            ? AttendanceStatus.PRESENT
            : AttendanceStatus.HALF_DAY;
          rec.source = AttendanceSource.REGULARIZED;
          if (!existing) rec.leaveTypeId = null;
        }
        await recRepo.save(rec);

        // synthetic events so the timeline is complete
        const evRepo = manager.getRepository(AttendanceEvent);
        await evRepo.save([
          evRepo.create({
            employeeId: row.employeeId,
            eventDate: row.date,
            eventAt: inAt,
            type: PunchType.PUNCH_IN,
            withinGeofence: false,
            source: 'REGULARIZATION',
            note: `Regularized by ${approver.email}`,
            createdByUserId: approver.userId,
          }),
          evRepo.create({
            employeeId: row.employeeId,
            eventDate: row.date,
            eventAt: outAt,
            type: PunchType.PUNCH_OUT,
            withinGeofence: false,
            source: 'REGULARIZATION',
            createdByUserId: approver.userId,
          }),
        ]);
      }

      row.status = dto.decision;
      row.decidedByUserId = approver.userId;
      row.decidedAt = new Date();
      row.decisionNote = dto.note ?? null;
      const saved = await regRepo.save(row);

      await this.auditService.record({
        entityName: 'AttendanceRegularization',
        entityId: saved.id,
        action: AuditAction.STATUS_CHANGE,
        user: approver,
        changes: { status: { old: from, new: dto.decision } },
        reason: dto.note,
      });
      return saved;
    });
  }
}
