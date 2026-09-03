import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  AppointmentStatus,
  AppointmentType,
} from '../../common/enums/patient.enum';

/**
 * Appointment scheduling. High volume; partition-ready by `scheduledAt` month.
 * (doctorId, scheduledAt) covers the doctor's day view; (patientId, scheduledAt)
 * covers the patient's history.
 */
@Entity('appointments')
@Index('idx_appt_doctor_time', ['doctorId', 'scheduledAt'])
@Index('idx_appt_patient_time', ['patientId', 'scheduledAt'])
@Index('idx_appt_time_status', ['scheduledAt', 'status'])
@Index('idx_appt_status', ['status'])
export class Appointment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  patientId: string;

  @Column({ type: 'bigint' })
  doctorId: string;

  @Column({ type: 'datetime' })
  scheduledAt: Date;

  @Column({ type: 'int', default: 15 })
  durationMin: number;

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.SCHEDULED,
  })
  status: AppointmentStatus;

  @Column({
    type: 'enum',
    enum: AppointmentType,
    default: AppointmentType.NEW,
  })
  type: AppointmentType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  department: string | null;

  @Column({ type: 'bigint', nullable: true })
  visitId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cancelReason: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
