import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('prescriptions')
@Index('idx_rx_patient_date', ['patientId', 'prescribedAt'])
@Index('idx_rx_visit', ['visitId'])
export class Prescription {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint', nullable: true })
  visitId: string | null;

  @Column({ type: 'bigint' })
  patientId: string;

  @Column({ type: 'bigint' })
  doctorId: string;

  @Column({ type: 'datetime' })
  prescribedAt: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
