import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('employee_salary_structures')
@Index('idx_ess_employee_active', ['employeeId', 'active'])
@Index('idx_ess_employee_effective', ['employeeId', 'effectiveFrom'])
export class EmployeeSalaryStructure {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  employeeId: string;

  @Column({ type: 'date' })
  effectiveFrom: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  basicMonthly: string;

  /** Denormalised: basic + Σ earning lines. */
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  grossMonthly: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
