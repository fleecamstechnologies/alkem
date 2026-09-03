import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Gender, PatientStatus } from '../../common/enums/patient.enum';

/**
 * Patient master — the largest-volume table in the app (~10M rows).
 *  - BIGINT auto-increment PK.
 *  - FULLTEXT(firstName,lastName) for name search; a plain index on `phone` for
 *    the "search by number" path that front-desk staff use constantly.
 *  - outstandingBalance / visitCount / lastVisitAt are denormalised and
 *    maintained transactionally (charges / visits).
 *  - soft delete so historical visits/charges stay resolvable.
 */
@Entity('patients')
@Index('idx_patients_phone', ['phone'])
@Index('idx_patients_doctor', ['assignedDoctorId'])
@Index('idx_patients_status_id', ['status', 'id'])
@Index('idx_patients_city_state', ['city', 'state'])
@Index('idx_patients_reg_date', ['registrationDate'])
@Index('ft_patients_name', ['firstName', 'lastName'], { fulltext: true })
export class Patient {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index('uq_patients_code', { unique: true })
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender | null;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  altPhone: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  bloodGroup: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  maritalStatus: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  addressLine1: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  addressLine2: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 12, nullable: true })
  pincode: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  emergencyName: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  emergencyPhone: string | null;

  @Column({ type: 'bigint', nullable: true })
  assignedDoctorId: string | null;

  @Column({ type: 'date' })
  registrationDate: string;

  @Column({ type: 'enum', enum: PatientStatus, default: PatientStatus.ACTIVE })
  status: PatientStatus;

  @Column({ type: 'text', nullable: true })
  allergies: string | null;

  @Column({ type: 'text', nullable: true })
  chronicConditions: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  outstandingBalance: string;

  @Column({ type: 'int', default: 0 })
  visitCount: number;

  @Column({ type: 'datetime', nullable: true })
  lastVisitAt: Date | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
