import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Professional-tax monthly slab for one state. Lookup: the row whose
 * [minGross, maxGross] band contains the employee's monthly gross.
 * `februaryAmount` is used only for February (Maharashtra levies a higher
 * amount in the last month of the year).
 */
@Entity('pt_slabs')
@Index('idx_pt_slabs_state_active', ['stateCode', 'active'])
export class PtSlab {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 4 })
  stateCode: string;

  @Column({ type: 'varchar', length: 60 })
  stateName: string;

  @Column({ type: 'date' })
  effectiveFrom: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  minGross: string;

  /** null = no upper bound. */
  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  maxGross: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  monthlyAmount: string;

  /** null = same as `monthlyAmount`. */
  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  februaryAmount: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
