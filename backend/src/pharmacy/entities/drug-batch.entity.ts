import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * One receipt of a drug: its own batch no, expiry, MRP and cost.
 * `quantityOnHand` is the denormalised running balance, folded transactionally
 * by `pharmacy_stock_movements`. FEFO dispensing orders by `expiryDate ASC`.
 */
@Entity('drug_batches')
@Index('idx_drug_batches_drug_expiry', ['drugId', 'expiryDate'])
@Index('idx_drug_batches_expiry', ['expiryDate'])
@Index('idx_drug_batches_drug_onhand', ['drugId', 'quantityOnHand'])
@Index('idx_drug_batches_grn', ['grnId'])
@Index('uq_drug_batch', ['drugId', 'batchNo', 'expiryDate'], { unique: true })
export class DrugBatch {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  drugId: string;

  @Column({ type: 'varchar', length: 60 })
  batchNo: string;

  @Column({ type: 'date' })
  expiryDate: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  mrp: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  purchasePrice: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  quantityReceived: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  quantityOnHand: string;

  @Column({ type: 'bigint', nullable: true })
  grnId: string | null;

  @Column({ type: 'bigint', nullable: true })
  supplierId: string | null;

  @Column({ type: 'date' })
  receivedDate: string;

  @CreateDateColumn()
  createdAt: Date;
}
