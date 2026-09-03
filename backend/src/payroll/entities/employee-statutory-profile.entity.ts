import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Per-employee statutory settings. One row per employee (auto-created with
 * defaults on first read). Filing identifiers here override the loose columns
 * on `employees`.
 */
@Entity('employee_statutory_profiles')
export class EmployeeStatutoryProfile {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index('uq_emp_statutory_employee', { unique: true })
  @Column({ type: 'bigint' })
  employeeId: string;

  @Column({ type: 'boolean', default: true })
  pfApplicable: boolean;

  /** true = PF wages use the actual basic (no ₹15,000 cap). */
  @Column({ type: 'boolean', default: false })
  pfUsesActualWage: boolean;

  /** null = auto (applicable when monthly gross <= ESI ceiling). */
  @Column({ type: 'boolean', nullable: true })
  esiApplicable: boolean | null;

  @Column({ type: 'varchar', length: 4, default: 'MH' })
  ptStateCode: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  uanNumber: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  pfAccountNumber: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  esiIpNumber: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
