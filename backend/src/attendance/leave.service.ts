import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LeaveType } from './entities/leave-type.entity';
import { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveRequest } from './entities/leave-request.entity';
import { AttendanceService } from './attendance.service';
import {
  CreateLeaveRequestDto,
  CreateLeaveTypeDto,
  DecideLeaveDto,
  QueryLeaveRequestsDto,
  UpdateLeaveTypeDto,
} from './dto/leave.dto';
import { LeaveRequestStatus } from '../common/enums/attendance.enum';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { addMoney } from '../common/utils/money.util';
import { countWorkingDays, eachDate, isWeekOff } from '../common/utils/working-days.util';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveType)
    private readonly typeRepo: Repository<LeaveType>,
    @InjectRepository(LeaveBalance)
    private readonly balanceRepo: Repository<LeaveBalance>,
    @InjectRepository(LeaveRequest)
    private readonly requestRepo: Repository<LeaveRequest>,
    private readonly attendanceService: AttendanceService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  // ---- leave types --------------------------------------------------

  listTypes(): Promise<LeaveType[]> {
    return this.typeRepo.find({ order: { code: 'ASC' } });
  }

  async createType(dto: CreateLeaveTypeDto): Promise<LeaveType> {
    const existing = await this.typeRepo.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Leave type ${dto.code} already exists`);
    }
    return this.typeRepo.save(
      this.typeRepo.create({
        code: dto.code,
        name: dto.name,
        paid: dto.paid ?? true,
        annualQuota: dto.annualQuota ?? '0',
        active: dto.active ?? true,
      }),
    );
  }

  async updateType(id: string, dto: UpdateLeaveTypeDto): Promise<LeaveType> {
    const type = await this.typeRepo.findOne({ where: { id } });
    if (!type) throw new NotFoundException(`Leave type ${id} not found`);
    Object.assign(type, {
      name: dto.name ?? type.name,
      paid: dto.paid ?? type.paid,
      annualQuota: dto.annualQuota ?? type.annualQuota,
      active: dto.active ?? type.active,
    });
    return this.typeRepo.save(type);
  }

  // ---- balances ---------------------------------------------------

  balancesFor(employeeId: string, year: number): Promise<LeaveBalance[]> {
    return this.balanceRepo.find({ where: { employeeId, year } });
  }

  /**
   * Seed / top-up `entitled` for every ACTIVE employee × ACTIVE leave type for a
   * year, in one statement.
   */
  async grantAnnualQuota(year: number): Promise<{ affected: number }> {
    const result: { affectedRows?: number } = await this.dataSource.query(
      `INSERT INTO leave_balances (employeeId, leaveTypeId, year, entitled, used, pending)
       SELECT e.id, lt.id, ?, lt.annualQuota, 0, 0
       FROM employees e
       CROSS JOIN leave_types lt
       WHERE e.deletedAt IS NULL AND e.status = 'ACTIVE' AND lt.active = 1
       ON DUPLICATE KEY UPDATE entitled = VALUES(entitled)`,
      [year],
    );
    return { affected: result.affectedRows ?? 0 };
  }

  // ---- requests -------------------------------------------------

  async listRequests(
    query: QueryLeaveRequestsDto,
  ): Promise<LeaveRequest[]> {
    const qb = this.requestRepo
      .createQueryBuilder('r')
      .orderBy('r.createdAt', 'DESC')
      .limit(Math.min(query.limit ?? 100, 500));
    if (query.employeeId !== undefined) {
      qb.andWhere('r.employeeId = :eid', { eid: String(query.employeeId) });
    }
    if (query.status) qb.andWhere('r.status = :status', { status: query.status });
    const rows = await qb.getMany();

    const eids = [...new Set(rows.map((r) => String(r.employeeId)))];
    const emps: Array<{ id: string; name: string; code: string }> = eids.length
      ? await this.dataSource.query(
          `SELECT id, CONCAT(firstName,' ',lastName) AS name, code
           FROM employees WHERE id IN (${eids.map(() => '?').join(',')})`,
          eids,
        )
      : [];
    const eMap = new Map(emps.map((e) => [String(e.id), e]));
    return rows.map(
      (r) =>
        ({
          ...r,
          employeeName: eMap.get(String(r.employeeId))?.name ?? null,
          employeeCode: eMap.get(String(r.employeeId))?.code ?? null,
        }) as unknown as LeaveRequest,
    );
  }

  /** Working days in [from,to] that count against the leave. */
  private leaveDayCount(from: string, to: string, halfDay: boolean): number {
    if (halfDay) return 0.5;
    return countWorkingDays(from, to);
  }

  private leaveDates(from: string, to: string): string[] {
    return eachDate(from, to).filter((d) => !isWeekOff(d));
  }

  async requestLeave(
    dto: CreateLeaveRequestDto,
    actor: AuthenticatedUser,
  ): Promise<LeaveRequest> {
    if (dto.toDate < dto.fromDate) {
      throw new BadRequestException('toDate is before fromDate');
    }
    if (dto.halfDay && dto.fromDate !== dto.toDate) {
      throw new BadRequestException('a half-day leave must be a single date');
    }
    const employeeId = String(dto.employeeId);
    const leaveTypeId = String(dto.leaveTypeId);
    const type = await this.typeRepo.findOne({ where: { id: leaveTypeId } });
    if (!type || !type.active) {
      throw new BadRequestException('unknown or inactive leave type');
    }

    const days = this.leaveDayCount(dto.fromDate, dto.toDate, dto.halfDay ?? false);
    if (days <= 0) {
      throw new BadRequestException('no working days in the selected range');
    }
    const year = Number(dto.fromDate.slice(0, 4));

    return this.dataSource.transaction(async (manager) => {
      const balanceRepo = manager.getRepository(LeaveBalance);
      let balance = await balanceRepo.findOne({
        where: { employeeId, leaveTypeId, year },
      });
      if (!balance) {
        balance = balanceRepo.create({
          employeeId,
          leaveTypeId,
          year,
          entitled: type.annualQuota,
          used: '0',
          pending: '0',
        });
      }
      if (type.paid) {
        const available =
          Number(balance.entitled) - Number(balance.used) - Number(balance.pending);
        if (days > available) {
          throw new BadRequestException(
            `insufficient ${type.code} balance: ${available} available, ${days} requested`,
          );
        }
      }
      balance.pending = addMoney(balance.pending, String(days));
      await balanceRepo.save(balance);

      const request = await manager.getRepository(LeaveRequest).save(
        manager.getRepository(LeaveRequest).create({
          employeeId,
          leaveTypeId,
          fromDate: dto.fromDate,
          toDate: dto.toDate,
          days: String(days),
          halfDay: dto.halfDay ?? false,
          reason: dto.reason ?? null,
          status: LeaveRequestStatus.PENDING,
          createdByUserId: actor.userId,
        }),
      );
      return request;
    });
  }

  async decideLeave(
    id: string,
    dto: DecideLeaveDto,
    actor: AuthenticatedUser,
  ): Promise<LeaveRequest> {
    if (
      dto.decision !== LeaveRequestStatus.APPROVED &&
      dto.decision !== LeaveRequestStatus.REJECTED &&
      dto.decision !== LeaveRequestStatus.CANCELLED
    ) {
      throw new BadRequestException('decision must be APPROVED, REJECTED or CANCELLED');
    }

    return this.dataSource.transaction(async (manager) => {
      const reqRepo = manager.getRepository(LeaveRequest);
      const balRepo = manager.getRepository(LeaveBalance);
      const request = await reqRepo.findOne({ where: { id } });
      if (!request) throw new NotFoundException(`Leave request ${id} not found`);

      const fromStatus = request.status;
      if (fromStatus === dto.decision) return request;
      if (
        fromStatus === LeaveRequestStatus.REJECTED ||
        (fromStatus === LeaveRequestStatus.CANCELLED &&
          dto.decision !== LeaveRequestStatus.CANCELLED)
      ) {
        throw new BadRequestException(
          `cannot move leave request from ${fromStatus} to ${dto.decision}`,
        );
      }

      const year = Number(request.fromDate.slice(0, 4));
      const balance = await balRepo.findOne({
        where: {
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          year,
        },
      });
      const days = String(request.days);
      const dates = this.leaveDates(request.fromDate, request.toDate);

      if (dto.decision === LeaveRequestStatus.APPROVED) {
        if (balance) {
          balance.pending = addMoney(balance.pending, `-${days}`);
          balance.used = addMoney(balance.used, days);
          await balRepo.save(balance);
        }
        await this.attendanceService.applyLeaveDays(
          manager,
          request.employeeId,
          request.leaveTypeId,
          request.halfDay ? [request.fromDate] : dates,
          request.halfDay,
        );
      } else if (dto.decision === LeaveRequestStatus.REJECTED) {
        if (balance) {
          balance.pending = addMoney(balance.pending, `-${days}`);
          await balRepo.save(balance);
        }
      } else {
        // CANCELLED
        if (balance) {
          if (fromStatus === LeaveRequestStatus.PENDING) {
            balance.pending = addMoney(balance.pending, `-${days}`);
          } else if (fromStatus === LeaveRequestStatus.APPROVED) {
            balance.used = addMoney(balance.used, `-${days}`);
          }
          await balRepo.save(balance);
        }
        if (fromStatus === LeaveRequestStatus.APPROVED) {
          await this.attendanceService.clearLeaveDays(
            manager,
            request.employeeId,
            request.halfDay ? [request.fromDate] : dates,
          );
        }
      }

      request.status = dto.decision;
      request.decidedByUserId = actor.userId;
      request.decidedAt = new Date();
      request.decisionNote = dto.note ?? null;
      const saved = await reqRepo.save(request);

      await this.auditService.record({
        entityName: 'LeaveRequest',
        entityId: saved.id,
        action: AuditAction.STATUS_CHANGE,
        user: actor,
        changes: { status: { old: fromStatus, new: dto.decision } },
        reason: dto.note,
      });
      return saved;
    });
  }
}
