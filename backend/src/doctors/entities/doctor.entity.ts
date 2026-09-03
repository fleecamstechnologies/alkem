import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DoctorStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Entity('doctors')
@Index('idx_doctors_speciality', ['speciality'])
@Index('idx_doctors_city_state', ['city', 'state'])
@Index('idx_doctors_territory', ['territory'])
@Index('idx_doctors_assigned_rep', ['assignedRepEmployeeId'])
@Index('ft_doctors_name', ['name'], { fulltext: true })
export class Doctor {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index('uq_doctors_code', { unique: true })
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  speciality: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  registrationNo: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  qualification: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  hospitalName: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  territory: string | null;

  @Column({ type: 'bigint', nullable: true })
  linkedCustomerId: string | null;

  /** Field rep (employee id) responsible for calling on this doctor. */
  @Column({ type: 'bigint', nullable: true })
  assignedRepEmployeeId: string | null;

  @Column({ type: 'enum', enum: DoctorStatus, default: DoctorStatus.ACTIVE })
  status: DoctorStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
