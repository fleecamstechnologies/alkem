import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TaxRegime } from '../../common/enums/payroll.enum';

/**
 * Report-grade statutory snapshot for one payslip (1:1). Holds the wage bases,
 * employer split and tax projection so ECR / ESI / 24Q / tax-computation
 * reports never re-derive anything. Partition-ready by `periodMonth`.
 */
@Entity('payslip_statutory')
@Index('uq_payslip_statutory_payslip', ['payslipId'], { unique: true })
@Index('idx_payslip_statutory_period', ['periodMonth'])
@Index('idx_payslip_statutory_emp_fy', ['employeeId', 'financialYear'])
export class PayslipStatutory {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  payslipId: string;

  @Column({ type: 'bigint' })
  employeeId: string;

  @Column({ type: 'varchar', length: 7 })
  periodMonth: string;

  @Column({ type: 'varchar', length: 9 })
  financialYear: string;

  // ---- Provident Fund ----------------------------------------
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  pfWages: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  epfEmployee: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  epsEmployer: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  epfEmployer: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  edliEmployer: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  pfAdminEmployer: string;

  /** Non-contributing-period days (= LOP days) for the ECR. */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  ncpDays: string;

  // ---- ESI --------------------------------------------------
  @Column({ type: 'boolean', default: false })
  esiApplicable: boolean;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  esiWages: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  esiEmployee: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  esiEmployer: string;

  // ---- Professional tax ------------------------------------
  @Column({ type: 'varchar', length: 4, nullable: true })
  ptStateCode: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  ptAmount: string;

  // ---- Income tax (projection snapshot) ------------------
  @Column({ type: 'enum', enum: TaxRegime, default: TaxRegime.NEW })
  taxRegime: TaxRegime;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  projectedAnnualGross: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  projectedTaxableIncome: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  projectedAnnualTax: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  tdsThisMonth: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  tdsYtd: string;

  @CreateDateColumn()
  createdAt: Date;
}
