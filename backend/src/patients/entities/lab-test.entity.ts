import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LabFlag, LabStatus } from '../../common/enums/patient.enum';

/** Flat lab order + result (no header/line split). */
@Entity('lab_tests')
@Index('idx_lab_patient_date', ['patientId', 'orderedAt'])
@Index('idx_lab_status', ['status'])
@Index('idx_lab_visit', ['visitId'])
export class LabTest {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  patientId: string;

  @Column({ type: 'bigint', nullable: true })
  visitId: string | null;

  @Column({ type: 'bigint', nullable: true })
  doctorId: string | null;

  @Column({ type: 'varchar', length: 160 })
  testName: string;

  @Column({ type: 'datetime' })
  orderedAt: Date;

  @Column({ type: 'enum', enum: LabStatus, default: LabStatus.ORDERED })
  status: LabStatus;

  @Column({ type: 'varchar', length: 120, nullable: true })
  resultValue: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  unit: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  refRange: string | null;

  @Column({ type: 'enum', enum: LabFlag, nullable: true })
  flag: LabFlag | null;

  @Column({ type: 'datetime', nullable: true })
  resultAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
