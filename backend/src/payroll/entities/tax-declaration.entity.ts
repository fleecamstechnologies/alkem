import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DeclarationStatus, TaxRegime } from '../../common/enums/payroll.enum';

/**
 * An employee's investment / regime declaration for one financial year. Filed
 * from the self-service portal; HR can LOCK it to freeze payroll inputs.
 * Amounts are annual rupees.
 */
@Entity('tax_declarations')
@Index('uq_tax_decl_employee_fy', ['employeeId', 'financialYear'], {
  unique: true,
})
export class TaxDeclaration {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  employeeId: string;

  @Column({ type: 'varchar', length: 9 })
  financialYear: string;

  @Column({ type: 'enum', enum: TaxRegime, default: TaxRegime.NEW })
  regime: TaxRegime;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  deduction80C: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  deduction80D: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  deduction80CCD1B: string;

  /** Annual rent paid (drives the old-regime HRA exemption). */
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  hraRentPaid: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  homeLoanInterest: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  otherExemptAllowances: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  otherChapterVIA: string;

  /** true = metro (HRA exemption uses 50% of basic, else 40%). */
  @Column({ type: 'boolean', default: false })
  metroCity: boolean;

  @Column({
    type: 'enum',
    enum: DeclarationStatus,
    default: DeclarationStatus.DRAFT,
  })
  status: DeclarationStatus;

  @Column({ type: 'datetime', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  lockedByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
