import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PayslipStatus } from '../../common/enums/payroll.enum';

@Entity('payslips')
@Index('uq_payslips_employee_period', ['employeeId', 'periodMonth'], {
  unique: true,
})
@Index('idx_payslips_run', ['payRunId'])
@Index('idx_payslips_period', ['periodMonth'])
export class Payslip {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  payRunId: string;

  @Column({ type: 'bigint' })
  employeeId: string;

  @Column({ type: 'varchar', length: 7 })
  periodMonth: string;

  @Column({ type: 'int' })
  totalDaysInMonth: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  paidDays: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  lopDays: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  basic: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  grossEarnings: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  totalDeductions: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  netPay: string;

  /** Σ EMPLOYER_CONTRIBUTION lines. Does not affect `netPay`. */
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  employerContributions: string;

  /** grossEarnings + employerContributions. */
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  ctcMonthly: string;

  /** Denormalised copy of the TDS deduction line for fast reports. */
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  tdsAmount: string;

  @Column({ type: 'enum', enum: PayslipStatus, default: PayslipStatus.GENERATED })
  status: PayslipStatus;

  @CreateDateColumn()
  createdAt: Date;
}
