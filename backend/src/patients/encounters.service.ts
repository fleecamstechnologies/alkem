import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Visit } from './entities/visit.entity';
import { Prescription } from './entities/prescription.entity';
import { PrescriptionItem } from './entities/prescription-item.entity';
import { LabTest } from './entities/lab-test.entity';
import { Appointment } from './entities/appointment.entity';
import { Patient } from './entities/patient.entity';
import {
  AddPrescriptionDto,
  CreateVisitDto,
  LabResultDto,
  OrderLabDto,
} from './patients.dto';
import { LabStatus } from '../common/enums/patient.enum';
import { Paginated, PaginationQuery } from '../common/dto/pagination';
import { PatientsService } from './patients.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class EncountersService {
  constructor(
    @InjectRepository(Visit)
    private readonly visitRepo: Repository<Visit>,
    @InjectRepository(LabTest)
    private readonly labRepo: Repository<LabTest>,
    private readonly dataSource: DataSource,
    private readonly patientsService: PatientsService,
  ) {}

  async createVisit(
    dto: CreateVisitDto,
    actor: AuthenticatedUser,
  ): Promise<Visit> {
    const patient = await this.dataSource
      .getRepository(Patient)
      .findOne({ where: { id: String(dto.patientId) }, select: ['id'] });
    if (!patient) throw new BadRequestException('patient not found');

    const visitDate = dto.visitDate
      ? new Date(dto.visitDate.replace(' ', 'T'))
      : new Date();

    return this.dataSource.transaction(async (manager) => {
      const visit = await manager.getRepository(Visit).save(
        manager.getRepository(Visit).create({
          patientId: String(dto.patientId),
          doctorId: String(dto.doctorId),
          appointmentId:
            dto.appointmentId != null ? String(dto.appointmentId) : null,
          visitDate,
          visitType: dto.visitType,
          chiefComplaint: dto.chiefComplaint ?? null,
          bpSystolic: dto.bpSystolic ?? null,
          bpDiastolic: dto.bpDiastolic ?? null,
          pulse: dto.pulse ?? null,
          temperature: dto.temperature ?? null,
          weightKg: dto.weightKg ?? null,
          heightCm: dto.heightCm ?? null,
          spo2: dto.spo2 ?? null,
          bmi: dto.bmi ?? null,
          diagnosis: dto.diagnosis ?? null,
          icdCodes: dto.icdCodes ?? null,
          clinicalNotes: dto.clinicalNotes ?? null,
          followUpDate: dto.followUpDate ?? null,
          createdByUserId: actor.userId,
        }),
      );

      if (dto.medicines && dto.medicines.length > 0) {
        const rx = await manager.getRepository(Prescription).save(
          manager.getRepository(Prescription).create({
            visitId: visit.id,
            patientId: visit.patientId,
            doctorId: visit.doctorId,
            prescribedAt: visitDate,
            notes: dto.prescriptionNotes ?? null,
            createdByUserId: actor.userId,
          }),
        );
        await manager.getRepository(PrescriptionItem).insert(
          dto.medicines.map((m) => ({
            prescriptionId: rx.id,
            drugName: m.drugName,
            strength: m.strength ?? null,
            dosage: m.dosage ?? null,
            route: m.route ?? null,
            frequency: m.frequency ?? null,
            durationDays: m.durationDays ?? null,
            quantity: m.quantity ?? null,
            instructions: m.instructions ?? null,
          })),
        );
      }

      if (dto.labs && dto.labs.length > 0) {
        await manager.getRepository(LabTest).insert(
          dto.labs.map((l) => ({
            patientId: visit.patientId,
            visitId: visit.id,
            doctorId: visit.doctorId,
            testName: l.testName,
            orderedAt: visitDate,
            status: LabStatus.ORDERED,
            notes: l.notes ?? null,
            createdByUserId: actor.userId,
          })),
        );
      }

      if (dto.appointmentId) {
        await manager
          .getRepository(Appointment)
          .update(String(dto.appointmentId), { visitId: visit.id });
      }

      await this.patientsService.bumpVisitStats(
        visit.patientId,
        visitDate,
        manager,
      );

      return visit;
    });
  }

  listVisits(
    patientId: string,
    query: PaginationQuery,
  ): Promise<Paginated<Visit>> {
    const limit = query.limit ?? 50;
    const qb = this.visitRepo
      .createQueryBuilder('v')
      .where('v.patientId = :pid', { pid: patientId })
      .orderBy('v.visitDate', 'DESC')
      .addOrderBy('v.id', 'DESC')
      .take(limit);
    if (query.cursor) qb.andWhere('v.id < :cursor', { cursor: query.cursor });
    return qb.getMany().then((rows) => ({
      rows,
      nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
      total: null,
      limit,
    }));
  }

  async getVisit(id: string) {
    const visit = await this.visitRepo.findOne({ where: { id } });
    if (!visit) throw new NotFoundException(`Visit ${id} not found`);
    const [prescriptions, labs] = await Promise.all([
      this.dataSource.query(
        `SELECT rx.id, DATE_FORMAT(rx.prescribedAt,'%Y-%m-%d %H:%i') AS prescribedAt,
                rx.notes
         FROM prescriptions rx WHERE rx.visitId = ?`,
        [id],
      ),
      this.labRepo.find({ where: { visitId: id }, order: { id: 'ASC' } }),
    ]);
    for (const rx of prescriptions as Array<Record<string, unknown>>) {
      rx.items = await this.dataSource.query(
        `SELECT drugName, strength, dosage, route, frequency, durationDays,
                quantity, instructions
         FROM prescription_items WHERE prescriptionId = ?`,
        [rx.id],
      );
    }
    return { ...visit, prescriptions, labs };
  }

  async addPrescription(
    visitId: string,
    dto: AddPrescriptionDto,
    actor: AuthenticatedUser,
  ) {
    const visit = await this.visitRepo.findOne({ where: { id: visitId } });
    if (!visit) throw new NotFoundException(`Visit ${visitId} not found`);
    return this.dataSource.transaction(async (manager) => {
      const rx = await manager.getRepository(Prescription).save(
        manager.getRepository(Prescription).create({
          visitId,
          patientId: visit.patientId,
          doctorId: visit.doctorId,
          prescribedAt: new Date(),
          notes: dto.notes ?? null,
          createdByUserId: actor.userId,
        }),
      );
      await manager.getRepository(PrescriptionItem).insert(
        dto.medicines.map((m) => ({
          prescriptionId: rx.id,
          drugName: m.drugName,
          strength: m.strength ?? null,
          dosage: m.dosage ?? null,
          route: m.route ?? null,
          frequency: m.frequency ?? null,
          durationDays: m.durationDays ?? null,
          quantity: m.quantity ?? null,
          instructions: m.instructions ?? null,
        })),
      );
      return rx;
    });
  }

  async orderLab(dto: OrderLabDto, actor: AuthenticatedUser): Promise<LabTest> {
    return this.labRepo.save(
      this.labRepo.create({
        patientId: String(dto.patientId),
        visitId: dto.visitId != null ? String(dto.visitId) : null,
        testName: dto.testName,
        orderedAt: new Date(),
        status: LabStatus.ORDERED,
        notes: dto.notes ?? null,
        createdByUserId: actor.userId,
      }),
    );
  }

  async updateLabResult(id: string, dto: LabResultDto): Promise<LabTest> {
    const lab = await this.labRepo.findOne({ where: { id } });
    if (!lab) throw new NotFoundException(`Lab test ${id} not found`);
    lab.resultValue = dto.resultValue;
    lab.unit = dto.unit ?? lab.unit;
    lab.refRange = dto.refRange ?? lab.refRange;
    lab.flag = dto.flag ?? lab.flag;
    lab.notes = dto.notes ?? lab.notes;
    lab.status = dto.status ?? LabStatus.RESULT_READY;
    lab.resultAt = new Date();
    return this.labRepo.save(lab);
  }

  patientPrescriptions(patientId: string) {
    return this.dataSource.query(
      `SELECT rx.id, DATE_FORMAT(rx.prescribedAt,'%Y-%m-%d') AS prescribedAt,
              rx.visitId, rx.notes, d.name AS doctorName,
              (SELECT COUNT(*) FROM prescription_items pi WHERE pi.prescriptionId = rx.id) AS itemCount
       FROM prescriptions rx LEFT JOIN doctors d ON d.id = rx.doctorId
       WHERE rx.patientId = ?
       ORDER BY rx.prescribedAt DESC LIMIT 100`,
      [patientId],
    );
  }

  patientLabs(patientId: string) {
    return this.labRepo.find({
      where: { patientId },
      order: { orderedAt: 'DESC', id: 'DESC' },
      take: 100,
    });
  }
}
