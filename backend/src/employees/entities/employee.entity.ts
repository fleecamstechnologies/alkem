import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  EmployeeStatus,
  EmploymentType,
  Gender,
} from '../../common/enums/employee.enum';

/**
 * Employee master. Same scale discipline as `customers`:
 *  - BIGINT auto-increment PK.
 *  - FULLTEXT(firstName, lastName) for search, never LIKE '%...%'.
 *  - soft delete so historical payslips / attendance stay resolvable.
 */
@Entity('employees')
@Index('idx_employees_status_id', ['status', 'id'])
@Index('idx_employees_department', ['departmentId'])
@Index('idx_employees_manager', ['reportingManagerId'])
@Index('idx_employees_joining', ['dateOfJoining'])
@Index('ft_employees_name', ['firstName', 'lastName'], { fulltext: true })
export class Employee {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index('uq_employees_code', { unique: true })
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Index('uq_employees_email', { unique: true })
  @Column({ type: 'varchar', length: 160, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender | null;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: string | null;

  @Column({ type: 'bigint', nullable: true })
  departmentId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  designation: string | null;

  @Column({
    type: 'enum',
    enum: EmploymentType,
    default: EmploymentType.FULL_TIME,
  })
  employmentType: EmploymentType;

  @Column({ type: 'enum', enum: EmployeeStatus, default: EmployeeStatus.ACTIVE })
  status: EmployeeStatus;

  @Column({ type: 'date' })
  dateOfJoining: string;

  @Column({ type: 'date', nullable: true })
  dateOfLeaving: string | null;

  @Column({ type: 'bigint', nullable: true })
  reportingManagerId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  workLocation: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  bankAccountName: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  bankAccountNumber: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  bankName: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  bankIfsc: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  panNumber: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  aadhaarNumber: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  pfNumber: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  uanNumber: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  esiNumber: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  ctcAnnual: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
