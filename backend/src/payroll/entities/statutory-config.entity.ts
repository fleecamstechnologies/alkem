import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Effective-dated statutory rate/ceiling configuration. Exactly one row is
 * `active` at a time; older rows are kept for historical pay-run recompute.
 * Money columns are rupees (DECIMAL 14,2); rate columns are percentages
 * (DECIMAL 6,3, e.g. 8.333 for EPS).
 */
@Entity('statutory_configs')
@Index('idx_statutory_configs_active', ['active'])
export class StatutoryConfig {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 9 })
  financialYear: string; // e.g. "2025-2026"

  @Column({ type: 'date' })
  effectiveFrom: string;

  // ---- Provident Fund -------------------------------------------
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 15000 })
  pfWageCeiling: string;

  @Column({ type: 'decimal', precision: 6, scale: 3, default: 12 })
  pfEmployeeRate: string;

  @Column({ type: 'decimal', precision: 6, scale: 3, default: 12 })
  pfEmployerRate: string;

  @Column({ type: 'decimal', precision: 6, scale: 3, default: 8.333 })
  epsRate: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 15000 })
  epsWageCeiling: string;

  @Column({ type: 'decimal', precision: 6, scale: 3, default: 0.5 })
  edliRate: string;

  @Column({ type: 'decimal', precision: 6, scale: 3, default: 0.5 })
  pfAdminRate: string;

  /** When true, PF wages are capped at `pfWageCeiling` unless the employee's
   * profile overrides with `pfUsesActualWage`. */
  @Column({ type: 'boolean', default: true })
  pfCapAtCeilingDefault: boolean;

  // ---- ESI ----------------------------------------------------
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 21000 })
  esiWageCeiling: string;

  @Column({ type: 'decimal', precision: 6, scale: 3, default: 0.75 })
  esiEmployeeRate: string;

  @Column({ type: 'decimal', precision: 6, scale: 3, default: 3.25 })
  esiEmployerRate: string;

  // ---- Income tax -------------------------------------------
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 50000 })
  stdDeductionOld: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 75000 })
  stdDeductionNew: string;

  @Column({ type: 'decimal', precision: 6, scale: 3, default: 4 })
  cessRate: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 500000 })
  rebate87aOldLimit: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 700000 })
  rebate87aNewLimit: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
