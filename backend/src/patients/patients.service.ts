import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Patient } from './entities/patient.entity';
import {
  CreatePatientDto,
  QueryPatientsDto,
  UpdatePatientDto,
} from './patients.dto';
import { Paginated } from '../common/dto/pagination';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { diffFields } from '../common/utils/diff.util';
import { toBooleanFulltextQuery } from '../common/utils/fulltext.util';
import { BALANCE_AFFECTING_CHARGE_STATUSES } from '../common/enums/patient.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

const EQ_FILTERS = ['assignedDoctorId', 'status', 'city'] as const;

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly repo: Repository<Patient>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async findPage(query: QueryPatientsDto): Promise<Paginated<Patient>> {
    const limit = query.limit ?? 50;
    const qb = this.repo.createQueryBuilder('p');
    this.applyFilters(qb, query);

    const hasFilter =
      !!query.q ||
      EQ_FILTERS.some((f) => query[f] !== undefined && query[f] !== '');
    let total: number | null = null;
    if (hasFilter) total = await qb.clone().getCount();

    qb.orderBy('p.id', 'DESC').take(limit);
    if (query.cursor) qb.andWhere('p.id < :cursor', { cursor: query.cursor });
    else if (query.page && query.page > 1) qb.skip((query.page - 1) * limit);

    const rows = await qb.getMany();
    const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;
    return { rows, nextCursor, total, limit };
  }

  private applyFilters(
    qb: SelectQueryBuilder<Patient>,
    query: QueryPatientsDto,
  ): void {
    for (const field of EQ_FILTERS) {
      const value = query[field];
      if (value !== undefined && value !== '') {
        qb.andWhere(`p.${field} = :${field}`, { [field]: value });
      }
    }
    if (query.q) {
      const term = query.q.trim();
      // Front desk searches by phone constantly: a mostly-numeric query hits the
      // phone index; anything else goes to FULLTEXT on the name.
      if (/^\+?\d[\d\s-]{4,}$/.test(term)) {
        const digits = term.replace(/[^\d]/g, '');
        qb.andWhere('(p.phone = :ph OR p.altPhone = :ph OR p.phone LIKE :phl)', {
          ph: digits,
          phl: `${digits}%`,
        });
      } else {
        const bq = toBooleanFulltextQuery(term);
        if (bq) {
          qb.andWhere(
            'MATCH(p.firstName, p.lastName) AGAINST (:ftq IN BOOLEAN MODE)',
            { ftq: bq },
          );
        } else {
          qb.andWhere(
            '(p.firstName LIKE :lk OR p.lastName LIKE :lk OR p.code LIKE :lk)',
            { lk: `${term}%` },
          );
        }
      }
    }
  }

  async findById(id: string): Promise<Patient> {
    const patient = await this.repo.findOne({ where: { id } });
    if (!patient) throw new NotFoundException(`Patient ${id} not found`);
    return patient;
  }

  async findByCode(code: string): Promise<Patient | null> {
    return this.repo.findOne({ where: { code } });
  }

  async create(
    dto: CreatePatientDto,
    actor: AuthenticatedUser,
  ): Promise<Patient> {
    const existing = await this.repo.findOne({
      where: { code: dto.code },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException(
        `A patient with code ${dto.code} already exists`,
      );
    }
    const patient = this.repo.create({
      ...dto,
      assignedDoctorId:
        dto.assignedDoctorId != null ? String(dto.assignedDoctorId) : null,
      registrationDate:
        dto.registrationDate ?? new Date().toISOString().slice(0, 10),
      outstandingBalance: '0',
      createdByUserId: actor.userId,
    });
    const saved = await this.repo.save(patient);
    await this.auditService.record({
      entityName: 'Patient',
      entityId: saved.id,
      action: AuditAction.CREATE,
      user: actor,
    });
    return saved;
  }

  async update(
    id: string,
    dto: UpdatePatientDto,
    actor: AuthenticatedUser,
  ): Promise<Patient> {
    const patient = await this.findById(id);
    const patch: Record<string, unknown> = { ...dto };
    if (dto.assignedDoctorId !== undefined) {
      patch.assignedDoctorId =
        dto.assignedDoctorId != null ? String(dto.assignedDoctorId) : null;
    }
    const changes = diffFields(
      patient as unknown as Record<string, unknown>,
      patch,
    );
    if (Object.keys(changes).length === 0) return patient;
    Object.assign(patient, patch);
    const saved = await this.repo.save(patient);
    await this.auditService.record({
      entityName: 'Patient',
      entityId: saved.id,
      action: AuditAction.UPDATE,
      user: actor,
      changes,
    });
    return saved;
  }

  async softRemove(id: string, actor: AuthenticatedUser): Promise<void> {
    const patient = await this.findById(id);
    await this.repo.softRemove(patient);
    await this.auditService.record({
      entityName: 'Patient',
      entityId: id,
      action: AuditAction.DELETE,
      user: actor,
    });
  }

  async search(term: string, limit = 10): Promise<Patient[]> {
    const r = await this.findPage({ q: term, limit } as QueryPatientsDto);
    return r.rows;
  }

  /** Recompute one patient's denormalised balance from the charge ledger. */
  async recomputeOutstanding(
    patientId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const runner = manager ?? this.dataSource.manager;
    await runner.query(
      `UPDATE patients p
         SET p.outstandingBalance = (
           SELECT COALESCE(SUM(
             CASE WHEN c.kind IN ('INVOICE','ADJUSTMENT') THEN c.amount ELSE -c.amount END
           ), 0)
           FROM patient_charges c
           WHERE c.patientId = p.id AND c.status IN (?, ?)
         )
       WHERE p.id = ?`,
      [...BALANCE_AFFECTING_CHARGE_STATUSES, patientId],
    );
  }

  async recomputeOutstandingForIds(
    ids: string[],
    manager?: EntityManager,
  ): Promise<void> {
    const runner = manager ?? this.dataSource.manager;
    const unique = [...new Set(ids)];
    const CHUNK = 1000;
    for (let i = 0; i < unique.length; i += CHUNK) {
      const slice = unique.slice(i, i + CHUNK);
      const ph = slice.map(() => '?').join(',');
      await runner.query(
        `UPDATE patients p
           LEFT JOIN (
             SELECT c.patientId AS pid,
                    SUM(CASE WHEN c.kind IN ('INVOICE','ADJUSTMENT') THEN c.amount ELSE -c.amount END) AS bal
             FROM patient_charges c
             WHERE c.status IN (?, ?) AND c.patientId IN (${ph})
             GROUP BY c.patientId
           ) t ON t.pid = p.id
           SET p.outstandingBalance = COALESCE(t.bal, 0)
           WHERE p.id IN (${ph})`,
        [...BALANCE_AFFECTING_CHARGE_STATUSES, ...slice, ...slice],
      );
    }
  }

  async recomputeAllOutstanding(manager?: EntityManager): Promise<void> {
    const runner = manager ?? this.dataSource.manager;
    await runner.query(
      `UPDATE patients p
         LEFT JOIN (
           SELECT c.patientId AS pid,
                  SUM(CASE WHEN c.kind IN ('INVOICE','ADJUSTMENT') THEN c.amount ELSE -c.amount END) AS bal
           FROM patient_charges c
           WHERE c.status IN (?, ?)
           GROUP BY c.patientId
         ) t ON t.pid = p.id
         SET p.outstandingBalance = COALESCE(t.bal, 0)`,
      [...BALANCE_AFFECTING_CHARGE_STATUSES],
    );
  }

  /** Bump denormalised visit stats; call inside the visit-create transaction. */
  async bumpVisitStats(
    patientId: string,
    visitDate: Date,
    manager: EntityManager,
  ): Promise<void> {
    await manager.query(
      `UPDATE patients
         SET visitCount = visitCount + 1,
             lastVisitAt = GREATEST(COALESCE(lastVisitAt, '1970-01-01'), ?)
       WHERE id = ?`,
      [visitDate, patientId],
    );
  }

  /** Aggregated medical history for the patient detail screen. */
  async medicalHistory(id: string) {
    const patient = await this.findById(id);
    const [visits, meds, labs] = await Promise.all([
      this.dataSource.query(
        `SELECT v.id, DATE_FORMAT(v.visitDate,'%Y-%m-%d %H:%i') AS visitDate,
                v.visitType, v.chiefComplaint, v.diagnosis, v.followUpDate,
                v.doctorId, d.name AS doctorName
         FROM visits v LEFT JOIN doctors d ON d.id = v.doctorId
         WHERE v.patientId = ?
         ORDER BY v.visitDate DESC LIMIT 100`,
        [id],
      ),
      this.dataSource.query(
        `SELECT pi.drugName, pi.strength, pi.dosage, pi.frequency, pi.durationDays,
                DATE_FORMAT(rx.prescribedAt,'%Y-%m-%d') AS prescribedAt
         FROM prescription_items pi
         JOIN prescriptions rx ON rx.id = pi.prescriptionId
         WHERE rx.patientId = ?
         ORDER BY rx.prescribedAt DESC LIMIT 50`,
        [id],
      ),
      this.dataSource.query(
        `SELECT testName, status, resultValue, unit, refRange, flag,
                DATE_FORMAT(orderedAt,'%Y-%m-%d') AS orderedAt
         FROM lab_tests WHERE patientId = ?
         ORDER BY orderedAt DESC LIMIT 50`,
        [id],
      ),
    ]);
    return {
      patient,
      allergies: patient.allergies,
      chronicConditions: patient.chronicConditions,
      visits,
      recentMedicines: meds,
      recentLabs: labs,
    };
  }
}
