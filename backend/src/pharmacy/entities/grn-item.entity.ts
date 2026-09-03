import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('grn_items')
@Index('idx_grn_items_grn', ['grnId'])
export class GrnItem {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  grnId: string;

  @Column({ type: 'bigint' })
  drugId: string;

  @Column({ type: 'varchar', length: 60 })
  batchNo: string;

  @Column({ type: 'date' })
  expiryDate: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  freeQuantity: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  purchasePrice: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  mrp: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  gstRate: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  lineTotal: string;
}
