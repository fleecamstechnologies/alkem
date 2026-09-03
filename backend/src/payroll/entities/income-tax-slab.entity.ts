import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TaxRegime } from '../../common/enums/payroll.enum';

/**
 * One income-tax slab band for a regime + financial year. Annual amounts.
 * `maxAnnual` null = no upper bound (top band).
 */
@Entity('income_tax_slabs')
@Index('idx_it_slabs_regime_fy', ['regime', 'financialYear'])
export class IncomeTaxSlab {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'enum', enum: TaxRegime })
  regime: TaxRegime;

  @Column({ type: 'varchar', length: 9 })
  financialYear: string;

  @Column({ type: 'date' })
  effectiveFrom: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  minAnnual: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  maxAnnual: string | null;

  @Column({ type: 'decimal', precision: 6, scale: 3, default: 0 })
  ratePercent: string;

  @CreateDateColumn()
  createdAt: Date;
}
