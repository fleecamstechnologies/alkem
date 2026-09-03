import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VisitType } from '../../common/enums/patient.enum';

/** A clinical encounter. High volume; partition-ready by `visitDate` month. */
@Entity('visits')
@Index('idx_visits_patient_date', ['patientId', 'visitDate', 'id'])
@Index('idx_visits_doctor_date', ['doctorId', 'visitDate'])
@Index('idx_visits_date', ['visitDate'])
// Idempotency key for the bulk visit importer: a patient has at most one
// encounter at a given timestamp, so re-importing the same history file updates
// rather than duplicates.
@Index('uq_visits_patient_visitdate', ['patientId', 'visitDate'], { unique: true })
export class Visit {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  patientId: string;

  @Column({ type: 'bigint' })
  doctorId: string;

  @Column({ type: 'bigint', nullable: true })
  appointmentId: string | null;

  @Column({ type: 'datetime' })
  visitDate: Date;

  @Column({ type: 'enum', enum: VisitType, default: VisitType.OPD })
  visitType: VisitType;

  @Column({ type: 'varchar', length: 500, nullable: true })
  chiefComplaint: string | null;

  @Column({ type: 'int', nullable: true })
  bpSystolic: number | null;

  @Column({ type: 'int', nullable: true })
  bpDiastolic: number | null;

  @Column({ type: 'int', nullable: true })
  pulse: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  temperature: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  weightKg: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  heightCm: string | null;

  @Column({ type: 'int', nullable: true })
  spo2: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  bmi: string | null;

  @Column({ type: 'text', nullable: true })
  diagnosis: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  icdCodes: string | null;

  @Column({ type: 'text', nullable: true })
  clinicalNotes: string | null;

  @Column({ type: 'date', nullable: true })
  followUpDate: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
