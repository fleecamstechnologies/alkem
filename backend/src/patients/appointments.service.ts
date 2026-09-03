import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Appointment } from './entities/appointment.entity';
import { Visit } from './entities/visit.entity';
import { Patient } from './entities/patient.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import {
  BookAppointmentDto,
  CompleteAppointmentDto,
  QueryAppointmentsDto,
} from './patients.dto';
import { AppointmentStatus } from '../common/enums/patient.enum';
import { Paginated } from '../common/dto/pagination';
import { PatientsService } from './patients.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

const ALLOWED: Record<AppointmentStatus, AppointmentStatus[]> = {
  [AppointmentStatus.SCHEDULED]: [
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CHECKED_IN,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.CONFIRMED]: [
    AppointmentStatus.CHECKED_IN,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.CHECKED_IN]: [
    AppointmentStatus.IN_PROGRESS,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED,
  ],
  [AppointmentStatus.IN_PROGRESS]: [AppointmentStatus.COMPLETED],
  [AppointmentStatus.COMPLETED]: [],
  [AppointmentStatus.CANCELLED]: [],
  [AppointmentStatus.NO_SHOW]: [],
};

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly repo: Repository<Appointment>,
    private readonly dataSource: DataSource,
    private readonly patientsService: PatientsService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async book(
    dto: BookAppointmentDto,
    actor: AuthenticatedUser,
  ): Promise<Appointment> {
    const patient = await this.dataSource
      .getRepository(Patient)
      .findOne({ where: { id: String(dto.patientId) }, select: ['id'] });
    if (!patient) throw new BadRequestException('patient not found');
    const doctor = await this.dataSource
      .getRepository(Doctor)
      .findOne({ where: { id: String(dto.doctorId) }, select: ['id'] });
    if (!doctor) throw new BadRequestException('doctor not found');

    const appt = this.repo.create({
      patientId: String(dto.patientId),
      doctorId: String(dto.doctorId),
      scheduledAt: new Date(dto.scheduledAt.replace(' ', 'T')),
      durationMin: dto.durationMin ?? 15,
      type: dto.type,
      reason: dto.reason ?? null,
      department: dto.department ?? null,
      status: AppointmentStatus.SCHEDULED,
      createdByUserId: actor.userId,
    });
    return this.repo.save(appt);
  }

  async list(
    query: QueryAppointmentsDto,
    forcedDoctorId?: string | null,
  ): Promise<Paginated<Appointment>> {
    const limit = query.limit ?? 50;
    const qb = this.repo.createQueryBuilder('a');
    const doctorId = forcedDoctorId ?? query.doctorId;
    if (doctorId != null && doctorId !== '') {
      qb.andWhere('a.doctorId = :doctorId', { doctorId: String(doctorId) });
    }
    if (query.patientId != null) {
      qb.andWhere('a.patientId = :pid', { pid: String(query.patientId) });
    }
    if (query.status) qb.andWhere('a.status = :status', { status: query.status });
    if (query.from) qb.andWhere('a.scheduledAt >= :from', { from: query.from });
    if (query.to) {
      qb.andWhere('a.scheduledAt < :to', { to: `${query.to} 23:59:59` });
    }
    qb.orderBy('a.scheduledAt', 'DESC').addOrderBy('a.id', 'DESC').take(limit);
    if (query.cursor) {
      const [d, i] = query.cursor.split('_');
      qb.andWhere(
        '(a.scheduledAt < :cd OR (a.scheduledAt = :cd AND a.id < :ci))',
        { cd: d, ci: i },
      );
    }
    const rows = await qb.getMany();
    const last = rows[rows.length - 1];
    const nextCursor =
      rows.length === limit && last
        ? `${last.scheduledAt.toISOString()}_${last.id}`
        : null;
    const enriched = await this.attachNames(rows);
    return { rows: enriched as unknown as Appointment[], nextCursor, total: null, limit };
  }

  /** Batch-resolve patient + doctor display names for a page of appointments. */
  private async attachNames(rows: Appointment[]) {
    if (!rows.length) return rows;
    const pids = [...new Set(rows.map((r) => String(r.patientId)))];
    const dids = [
      ...new Set(rows.map((r) => String(r.doctorId)).filter(Boolean)),
    ];
    const [patients, doctors] = await Promise.all([
      pids.length
        ? this.dataSource.query(
            `SELECT id, CONCAT(firstName,' ',lastName) AS name, code
             FROM patients WHERE id IN (${pids.map(() => '?').join(',')})`,
            pids,
          )
        : [],
      dids.length
        ? this.dataSource.query(
            `SELECT id, name, code FROM doctors
             WHERE id IN (${dids.map(() => '?').join(',')})`,
            dids,
          )
        : [],
    ]);
    const pMap = new Map(
      (patients as Array<Record<string, string>>).map((p) => [String(p.id), p]),
    );
    const dMap = new Map(
      (doctors as Array<Record<string, string>>).map((d) => [String(d.id), d]),
    );
    return rows.map((r) => ({
      ...r,
      patientName: pMap.get(String(r.patientId))?.name ?? null,
      patientCode: pMap.get(String(r.patientId))?.code ?? null,
      doctorName: dMap.get(String(r.doctorId))?.name ?? null,
      doctorCode: dMap.get(String(r.doctorId))?.code ?? null,
    }));
  }

  async findById(id: string): Promise<Appointment> {
    const appt = await this.repo.findOne({ where: { id } });
    if (!appt) throw new NotFoundException(`Appointment ${id} not found`);
    return appt;
  }

  async updateStatus(
    id: string,
    status: AppointmentStatus,
    cancelReason?: string,
  ): Promise<Appointment> {
    const appt = await this.findById(id);
    if (!ALLOWED[appt.status].includes(status)) {
      throw new BadRequestException(
        `cannot move appointment from ${appt.status} to ${status}`,
      );
    }
    appt.status = status;
    if (status === AppointmentStatus.CANCELLED) {
      appt.cancelReason = cancelReason ?? null;
    }
    const saved = await this.repo.save(appt);
    await this.cache.del('appt:dashboard');
    return saved;
  }

  /** Mark COMPLETED; optionally spawn a linked visit. */
  async complete(
    id: string,
    dto: CompleteAppointmentDto,
    actor: AuthenticatedUser,
  ): Promise<{ appointment: Appointment; visitId: string | null }> {
    const appt = await this.findById(id);
    if (
      appt.status === AppointmentStatus.CANCELLED ||
      appt.status === AppointmentStatus.NO_SHOW
    ) {
      throw new BadRequestException(`cannot complete a ${appt.status} appointment`);
    }

    return this.dataSource.transaction(async (manager) => {
      let visitId: string | null = appt.visitId;
      if (dto.createVisit && !visitId) {
        const now = new Date();
        const visit = await manager.getRepository(Visit).save(
          manager.getRepository(Visit).create({
            patientId: appt.patientId,
            doctorId: appt.doctorId,
            appointmentId: appt.id,
            visitDate: now,
            chiefComplaint: dto.chiefComplaint ?? appt.reason ?? null,
            diagnosis: dto.diagnosis ?? null,
            clinicalNotes: dto.clinicalNotes ?? null,
            createdByUserId: actor.userId,
          }),
        );
        visitId = visit.id;
        await this.patientsService.bumpVisitStats(
          appt.patientId,
          now,
          manager,
        );
      }
      appt.status = AppointmentStatus.COMPLETED;
      appt.visitId = visitId;
      const saved = await manager.getRepository(Appointment).save(appt);
      await this.cache.del('appt:dashboard');
      return { appointment: saved, visitId };
    });
  }

  async calendar(doctorId: string, from: string, to: string) {
    return this.dataSource.query(
      `SELECT a.id, a.patientId, a.doctorId,
              DATE_FORMAT(a.scheduledAt,'%Y-%m-%d') AS day,
              DATE_FORMAT(a.scheduledAt,'%H:%i') AS time,
              a.status, a.type, a.reason,
              CONCAT(p.firstName,' ',p.lastName) AS patientName, p.code AS patientCode
       FROM appointments a
       JOIN patients p ON p.id = a.patientId
       WHERE a.doctorId = ? AND a.scheduledAt >= ? AND a.scheduledAt < ?
       ORDER BY a.scheduledAt
       LIMIT 500`,
      [doctorId, from, `${to} 23:59:59`],
    );
  }

  async dashboard() {
    const cached = await this.cache.get('appt:dashboard');
    if (cached) return cached;
    const today = new Date().toISOString().slice(0, 10);
    const rows: Array<{ status: string; count: string }> =
      await this.dataSource.query(
        `SELECT status, COUNT(*) AS count FROM appointments
         WHERE scheduledAt >= ? AND scheduledAt < ?
         GROUP BY status`,
        [today, `${today} 23:59:59`],
      );
    const result = {
      date: today,
      byStatus: rows.map((r) => ({ status: r.status, count: Number(r.count) })),
      total: rows.reduce((s, r) => s + Number(r.count), 0),
    };
    await this.cache.set('appt:dashboard', result, 60_000);
    return result;
  }
}
