import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PharmacyMovementKind } from '../../common/enums/pharmacy.enum';

/**
 * Signed stock ledger for drug batches. +in (GRN_IN, RETURN_IN), -out
 * (DISPENSE_OUT, EXPIRY_WRITEOFF), +/- ADJUST. Partition-ready by `movementDate`.
 */
@Entity('pharmacy_stock_movements')
@Index('idx_pharm_mov_drug_date', ['drugId', 'movementDate'])
@Index('idx_pharm_mov_batch', ['batchId'])
export class PharmacyStockMovement {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  drugId: string;

  @Column({ type: 'bigint' })
  batchId: string;

  @Column({ type: 'enum', enum: PharmacyMovementKind })
  kind: PharmacyMovementKind;

  /** Signed quantity: positive = into stock, negative = out of stock. */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  qty: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  refType: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  refId: string | null;

  @Column({ type: 'date' })
  movementDate: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
