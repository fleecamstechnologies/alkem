import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AttendanceEvent } from './entities/attendance-event.entity';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { OfficeLocation } from './entities/office-location.entity';
import { OfficeLocationsService } from './office-locations.service';
import { SettingsService } from './settings.service';
import { PunchDto } from './dto/punch.dto';
import {
  AttendanceSource,
  AttendanceStatus,
  PunchType,
} from '../common/enums/attendance.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

type PunchState = 'OUT' | 'IN' | 'ON_BREAK';

/** Statuses the punch flow must never overwrite. */
const PROTECTED_STATUSES: AttendanceStatus[] = [
  AttendanceStatus.ON_LEAVE,
  AttendanceStatus.HOLIDAY,
  AttendanceStatus.WEEK_OFF,
];

export interface PunchStatus {
  date: string;
  state: PunchState;
  since: string | null;
  office: { id: string; name: string; distanceM: number } | null;
  firstInAt: string | null;
  lastOutAt: string | null;
  breakMinutes: number;
  workedMinutes: number;
  status: AttendanceStatus | null;
  events: Array<{
    id: string;
    type: PunchType;
    eventAt: string;
    officeName: string | null;
    distanceM: number | null;
    withinGeofence: boolean;
    source: string;
  }>;
}

@Injectable()
export class PunchService {
  constructor(
    @InjectRepository(AttendanceEvent)
    private readonly eventRepo: Repository<AttendanceEvent>,
    @InjectRepository(AttendanceRecord)
    private readonly recordRepo: Repository<AttendanceRecord>,
    @InjectRepository(OfficeLocation)
    private readonly officeRepo: Repository<OfficeLocation>,
    private readonly officesService: OfficeLocationsService,
    private readonly settingsService: SettingsService,
  ) {}

  private serverToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private deriveState(events: AttendanceEvent[]): {
    state: PunchState;
    since: Date | null;
  } {
    let state: PunchState = 'OUT';
    let since: Date | null = null;
    for (const e of events) {
      if (e.type === PunchType.PUNCH_IN) {
        state = 'IN';
        since = e.eventAt;
      } else if (e.type === PunchType.BREAK_START) {
        state = 'ON_BREAK';
        since = e.eventAt;
      } else if (e.type === PunchType.BREAK_END) {
        state = 'IN';
        since = e.eventAt;
      } else if (e.type === PunchType.PUNCH_OUT) {
        state = 'OUT';
        since = e.eventAt;
      }
    }
    return { state, since };
  }

  private dayEvents(
    employeeId: string,
    date: string,
  ): Promise<AttendanceEvent[]> {
    return this.eventRepo.find({
      where: { employeeId, eventDate: date },
      order: { eventAt: 'ASC', id: 'ASC' },
    });
  }

  async status(employeeId: string, date?: string): Promise<PunchStatus> {
    const day = date ?? this.serverToday();
    const events = await this.dayEvents(employeeId, day);
    const { state, since } = this.deriveState(events);
    const officeIds = [
      ...new Set(events.map((e) => e.officeId).filter(Boolean) as string[]),
    ];
    const offices = officeIds.length
      ? await this.officeRepo.find({ where: { id: In(officeIds) } })
      : [];
    const officeName = new Map(offices.map((o) => [o.id, o.name]));

    const record = await this.recordRepo.findOne({
      where: { employeeId, date: day },
    });
    const computed = this.computeDay(events);

    return {
      date: day,
      state,
      since: since ? since.toISOString() : null,
      office:
        state !== 'OUT' && events.length
          ? this.lastOfficeInfo(events, officeName)
          : null,
      firstInAt: computed.firstInAt ? computed.firstInAt.toISOString() : null,
      lastOutAt: computed.lastOutAt ? computed.lastOutAt.toISOString() : null,
      breakMinutes: computed.breakMinutes + computed.openBreakMinutes,
      workedMinutes: computed.workedMinutes,
      status: record?.status ?? null,
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        eventAt: e.eventAt.toISOString(),
        officeName: e.officeId ? (officeName.get(e.officeId) ?? null) : null,
        distanceM: e.distanceM,
        withinGeofence: e.withinGeofence,
        source: e.source,
      })),
    };
  }

  private lastOfficeInfo(
    events: AttendanceEvent[],
    names: Map<string, string>,
  ): { id: string; name: string; distanceM: number } | null {
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const e = events[i];
      if (e.officeId) {
        return {
          id: e.officeId,
          name: names.get(e.officeId) ?? 'Office',
          distanceM: e.distanceM ?? 0,
        };
      }
    }
    return null;
  }

  async punch(
    employeeId: string,
    dto: PunchDto,
    actor: AuthenticatedUser,
  ): Promise<PunchStatus> {
    // localDate must be near the server date (guards against a bad client clock).
    const serverMs = Date.parse(this.serverToday());
    const clientMs = Date.parse(dto.localDate);
    if (Number.isNaN(clientMs) || Math.abs(clientMs - serverMs) > 86_400_000) {
      throw new BadRequestException('localDate is not today');
    }

    // Geofence.
    const nearest = await this.officesService.nearest(
      dto.latitude,
      dto.longitude,
    );
    if (!nearest) {
      throw new BadRequestException(
        'No office locations configured — ask HR to add one',
      );
    }
    if (!nearest.withinGeofence) {
      throw new ForbiddenException(
        `You are ~${nearest.distanceM} m from ${nearest.office.name} — must be within ${nearest.office.radiusMeters} m to punch`,
      );
    }

    const now = new Date();
    const events = await this.dayEvents(employeeId, dto.localDate);
    const { state } = this.deriveState(events);

    const toInsert: Array<Partial<AttendanceEvent>> = [];
    const base = {
      employeeId,
      eventDate: dto.localDate,
      latitude: String(dto.latitude),
      longitude: String(dto.longitude),
      accuracyM: dto.accuracyM ?? null,
      officeId: nearest.office.id,
      distanceM: nearest.distanceM,
      withinGeofence: true,
      source: 'WEB',
      createdByUserId: actor.userId,
    };

    switch (dto.type) {
      case PunchType.PUNCH_IN:
        if (state !== 'OUT') {
          throw new BadRequestException(
            state === 'ON_BREAK'
              ? 'You are on a break — end the break, then punch out'
              : 'You are already punched in',
          );
        }
        toInsert.push({ ...base, type: PunchType.PUNCH_IN, eventAt: now, note: dto.note ?? null });
        break;
      case PunchType.BREAK_START:
        if (state !== 'IN') {
          throw new BadRequestException('Punch in before starting a break');
        }
        toInsert.push({ ...base, type: PunchType.BREAK_START, eventAt: now, note: dto.note ?? null });
        break;
      case PunchType.BREAK_END:
        if (state !== 'ON_BREAK') {
          throw new BadRequestException('You are not on a break');
        }
        toInsert.push({ ...base, type: PunchType.BREAK_END, eventAt: now });
        break;
      case PunchType.PUNCH_OUT:
        if (state === 'OUT') {
          throw new BadRequestException('You are not punched in');
        }
        if (state === 'ON_BREAK') {
          toInsert.push({ ...base, type: PunchType.BREAK_END, eventAt: now });
        }
        toInsert.push({
          ...base,
          type: PunchType.PUNCH_OUT,
          eventAt: new Date(now.getTime() + (state === 'ON_BREAK' ? 1000 : 0)),
          note: dto.note ?? null,
        });
        break;
    }

    await this.eventRepo.save(toInsert.map((e) => this.eventRepo.create(e)));
    await this.recomputeDay(employeeId, dto.localDate);
    return this.status(employeeId, dto.localDate);
  }

  // ---- day recompute ------------------------------------------

  private computeDay(events: AttendanceEvent[]): {
    firstInAt: Date | null;
    lastOutAt: Date | null;
    breakMinutes: number;
    openBreakMinutes: number;
    workedMinutes: number;
    open: boolean;
  } {
    const ordered = [...events].sort(
      (a, b) => a.eventAt.getTime() - b.eventAt.getTime(),
    );
    const firstIn = ordered.find((e) => e.type === PunchType.PUNCH_IN) ?? null;
    let lastOut: AttendanceEvent | null = null;
    for (const e of ordered) if (e.type === PunchType.PUNCH_OUT) lastOut = e;

    let breakMs = 0;
    let openBreakStart: Date | null = null;
    for (const e of ordered) {
      if (e.type === PunchType.BREAK_START) openBreakStart = e.eventAt;
      else if (e.type === PunchType.BREAK_END && openBreakStart) {
        breakMs += e.eventAt.getTime() - openBreakStart.getTime();
        openBreakStart = null;
      }
    }
    const now = Date.now();
    const openBreakMs = openBreakStart ? now - openBreakStart.getTime() : 0;

    let workedMinutes = 0;
    if (firstIn) {
      const end = lastOut ? lastOut.eventAt.getTime() : now;
      const grossMs = Math.max(0, end - firstIn.eventAt.getTime());
      workedMinutes = Math.max(
        0,
        Math.round((grossMs - breakMs - openBreakMs) / 60_000),
      );
    }
    return {
      firstInAt: firstIn ? firstIn.eventAt : null,
      lastOutAt: lastOut ? lastOut.eventAt : null,
      breakMinutes: Math.round(breakMs / 60_000),
      openBreakMinutes: Math.round(openBreakMs / 60_000),
      workedMinutes,
      open: !!firstIn && !lastOut,
    };
  }

  /** Rebuild the `attendance_records` row for a day from its punch events. */
  async recomputeDay(employeeId: string, date: string): Promise<void> {
    const events = await this.dayEvents(employeeId, date);
    if (!events.length) return;
    const c = this.computeDay(events);
    if (!c.firstInAt) return;

    const settings = await this.settingsService.get();
    const workedHours = c.workedMinutes / 60;
    const meetsHalf = workedHours >= Number(settings.punchHalfDayHours);

    const existing = await this.recordRepo.findOne({
      where: { employeeId, date },
    });
    const protectedRow =
      !!existing && PROTECTED_STATUSES.includes(existing.status);

    const row = this.recordRepo.create({
      ...existing,
      employeeId,
      date,
      firstInAt: c.firstInAt,
      lastOutAt: c.lastOutAt,
      breakMinutes: c.breakMinutes,
      workedHours: workedHours.toFixed(2),
    });
    if (!protectedRow) {
      row.status = c.open
        ? AttendanceStatus.PRESENT
        : meetsHalf
          ? AttendanceStatus.PRESENT
          : AttendanceStatus.HALF_DAY;
      row.source = AttendanceSource.PUNCH;
      if (!existing) row.leaveTypeId = null;
    }
    await this.recordRepo.save(row);
  }

  events(filter: { employeeId?: number; from?: string; to?: string }) {
    const qb = this.eventRepo
      .createQueryBuilder('e')
      .orderBy('e.eventAt', 'DESC')
      .limit(2000);
    if (filter.employeeId !== undefined) {
      qb.andWhere('e.employeeId = :eid', { eid: String(filter.employeeId) });
    }
    if (filter.from) qb.andWhere('e.eventDate >= :from', { from: filter.from });
    if (filter.to) qb.andWhere('e.eventDate <= :to', { to: filter.to });
    return qb.getMany();
  }
}
