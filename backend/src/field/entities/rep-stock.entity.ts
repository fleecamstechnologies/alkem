import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Denormalised per-rep balance of a promo item; ledger is stock_movements. */
@Entity('rep_stock')
@Index('uq_rep_stock', ['repEmployeeId', 'promoItemId'], { unique: true })
export class RepStock {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  repEmployeeId: string;

  @Column({ type: 'bigint' })
  promoItemId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balance: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
