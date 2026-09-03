import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { Holiday } from './entities/holiday.entity';
import { LeaveType } from './entities/leave-type.entity';
import { Employee } from '../employees/entities/employee.entity';
import {
  AttendanceSummaryDto,
  MarkAttendanceDto,
  QueryAttendanceDto,
} from './dto/attendance.dto';
import {
  AttendanceSource,
  AttendanceStatus,
} from '../common/enums/attendance.enum';
import {
  eachDate,
  isWeekOff,
  monthDateRange,
} from '../common/utils/working-days.util';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

const CHUNK = 1000;

export interface MonthGridDay {
  date: string;
  status: AttendanceStatus;
  leaveTypeId: string | null;
  note: string | null;
  recorded: boolean;
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly repo: Repository<AttendanceRecord>,
    @InjectRepository(Holiday)
    private readonly holidayRepo: Repository<Holiday>,
    @InjectRepository(LeaveType)
    private readonly leaveTypeRepo: Repository<LeaveType>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async markAttendance(
    dto: MarkAttendanceDto,
    actor: AuthenticatedUser | null,
  ): Promise<AttendanceRecord> {
    const employeeId = String(dto.employeeId);
    const existing = await this.repo.findOne({
      where: { employeeId, date: dto.date },
    });
    const record = this.repo.create({
      ...existing,
      employeeId,
      date: dto.date,
      status: dto.status,
      leaveTypeId:
        dto.leaveTypeId !== undefined ? String(dto.leaveTypeId) : null,
      workedHours: dto.workedHours ?? null,
      note: dto.note ?? null,
      source: AttendanceSource.MANUAL,
      createdByUserId: actor?.userId ?? null,
    });
    return this.repo.save(record);
  }

  /** Bulk upsert (import pipeline). */
  async bulkMark(rows: Partial<AttendanceRecord>[]): Promise<void> {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      await this.repo
        .createQueryBuilder()
        .insert()
        .into(AttendanceRecord)
        .values(slice)
        .orUpdate(
          ['status', 'leaveTypeId', 'workedHours', 'note', 'source'],
          ['employeeId', 'date'],
        )
        .execute();
    }
  }

  async listRange(query: QueryAttendanceDto): Promise<AttendanceRecord[]> {
    const qb = this.repo.createQueryBuilder('a');
    if (query.employeeId !== undefined) {
      qb.andWhere('a.employeeId = :eid', { eid: String(query.employeeId) });
    }
    if (query.departmentId !== undefined) {
      qb.andWhere(
        'a.employeeId IN (SELECT id FROM employees WHERE departmentId = :did)',
        { did: String(query.departmentId) },
      );
    }
    if (query.from) qb.andWhere('a.date >= :from', { from: query.from });
    if (query.to) qb.andWhere('a.date <= :to', { to: query.to });
    return qb.orderBy('a.date', 'ASC').addOrderBy('a.employeeId', 'ASC').limit(20000).getMany();
  }

  /** Full month for one employee: recorded days plus default WEEK_OFF/HOLIDAY. */
  async monthGrid(
    employeeId: string,
    periodMonth: string,
  ): Promise<MonthGridDay[]> {
    const { from, to } = monthDateRange(periodMonth);
    const [records, holidays] = await Promise.all([
      this.repo.find({ where: { employeeId, date: In(eachDate(from, to)) } }),
      this.holidaySet(from, to),
    ]);
    const byDate = new Map(records.map((r) => [r.date, r]));

    return eachDate(from, to).map((date) => {
      const rec = byDate.get(date);
      if (rec) {
        return {
          date,
          status: rec.status,
          leaveTypeId: rec.leaveTypeId,
          note: rec.note,
          recorded: true,
        };
      }
      const status = holidays.has(date)
        ? AttendanceStatus.HOLIDAY
        : isWeekOff(date)
          ? AttendanceStatus.WEEK_OFF
          : AttendanceStatus.PRESENT;
      return { date, status, leaveTypeId: null, note: null, recorded: false };
    });
  }

  /**
   * Loss-of-pay days for one employee in a month: ABSENT days + unpaid
   * ON_LEAVE days + 0.5 per unpaid HALF_DAY. Week-offs / holidays never count.
   */
  async lopDaysFor(employeeId: string, periodMonth: string): Promise<number> {
    const { from, to } = monthDateRange(periodMonth);
    const unpaidTypeIds = (
      await this.leaveTypeRepo.find({ where: { paid: false } })
    ).map((t) => t.id);

    const records = await this.repo.find({
      where: { employeeId, date: In(eachDate(from, to)) },
    });

    let lop = 0;
    for (const r of records) {
      if (r.status === AttendanceStatus.ABSENT) {
        lop += 1;
      } else if (
        r.status === AttendanceStatus.ON_LEAVE &&
        r.leaveTypeId &&
        unpaidTypeIds.includes(r.leaveTypeId)
      ) {
        lop += 1;
      } else if (r.status === AttendanceStatus.HALF_DAY) {
        // Unpaid half day, or half day with no covering leave.
        if (!r.leaveTypeId || unpaidTypeIds.includes(r.leaveTypeId)) lop += 0.5;
      }
    }
    return lop;
  }

  async summary(dto: AttendanceSummaryDto) {
    const key = `att:summary:${dto.periodMonth}:${dto.departmentId ?? 'all'}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const { from, to } = monthDateRange(dto.periodMonth);
    const qb = this.repo
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('a.date >= :from AND a.date <= :to', { from, to })
      .groupBy('a.status');
    if (dto.departmentId !== undefined) {
      qb.andWhere(
        'a.employeeId IN (SELECT id FROM employees WHERE departmentId = :did)',
        { did: String(dto.departmentId) },
      );
    }
    const rows = await qb.getRawMany<{ status: string; count: string }>();

    const onLeaveToday = await this.repo.count({
      where: {
        date: new Date().toISOString().slice(0, 10),
        status: AttendanceStatus.ON_LEAVE,
      },
    });

    const result = {
      periodMonth: dto.periodMonth,
      byStatus: rows.map((r) => ({ status: r.status, count: Number(r.count) })),
      onLeaveToday,
    };
    await this.cache.set(key, result, 60_000);
    return result;
  }

  // ---- holidays -------------------------------------------------------

  listHolidays(year?: number): Promise<Holiday[]> {
    const qb = this.holidayRepo.createQueryBuilder('h').orderBy('h.date', 'ASC');
    if (year) {
      qb.where('h.date >= :from AND h.date <= :to', {
        from: `${year}-01-01`,
        to: `${year}-12-31`,
      });
    }
    return qb.getMany();
  }

  async addHoliday(date: string, name: string): Promise<Holiday> {
    const existing = await this.holidayRepo.findOne({ where: { date } });
    if (existing) {
      existing.name = name;
      return this.holidayRepo.save(existing);
    }
    return this.holidayRepo.save(this.holidayRepo.create({ date, name }));
  }

  async removeHoliday(id: string): Promise<void> {
    const h = await this.holidayRepo.findOne({ where: { id } });
    if (!h) throw new NotFoundException(`Holiday ${id} not found`);
    await this.holidayRepo.delete(id);
  }

  private async holidaySet(from: string, to: string): Promise<Set<string>> {
    const rows = await this.holidayRepo
      .createQueryBuilder('h')
      .where('h.date >= :from AND h.date <= :to', { from, to })
      .getMany();
    return new Set(rows.map((r) => r.date));
  }

  /**
   * Write ON_LEAVE / HALF_DAY attendance rows for an approved leave. Called by
   * LeaveService inside its transaction.
   */
  async applyLeaveDays(
    manager: EntityManager,
    employeeId: string,
    leaveTypeId: string,
    dates: string[],
    halfDay: boolean,
  ): Promise<void> {
    if (dates.length === 0) return;
    const values = dates.map((date) => ({
      employeeId,
      date,
      status: halfDay ? AttendanceStatus.HALF_DAY : AttendanceStatus.ON_LEAVE,
      leaveTypeId,
      source: AttendanceSource.LEAVE,
    }));
    await manager
      .createQueryBuilder()
      .insert()
      .into(AttendanceRecord)
      .values(values)
      .orUpdate(['status', 'leaveTypeId', 'source'], ['employeeId', 'date'])
      .execute();
  }

  /** Remove LEAVE-sourced rows in a range (leave cancelled). */
  async clearLeaveDays(
    manager: EntityManager,
    employeeId: string,
    dates: string[],
  ): Promise<void> {
    if (dates.length === 0) return;
    await manager
      .createQueryBuilder()
      .delete()
      .from(AttendanceRecord)
      .where('employeeId = :employeeId', { employeeId })
      .andWhere('date IN (:...dates)', { dates })
      .andWhere('source = :src', { src: AttendanceSource.LEAVE })
      .execute();
  }
}
