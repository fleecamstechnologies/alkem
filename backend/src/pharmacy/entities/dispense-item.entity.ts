import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('dispense_items')
@Index('idx_dispense_items_dispense', ['dispenseId'])
export class DispenseItem {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  dispenseId: string;

  @Column({ type: 'bigint' })
  drugId: string;

  @Column({ type: 'bigint' })
  batchId: string;

  @Column({ type: 'bigint', nullable: true })
  prescriptionItemId: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  mrp: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  gstRate: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  discount: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  lineTotal: string;
}
