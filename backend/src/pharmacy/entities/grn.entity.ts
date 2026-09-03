import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GrnStatus } from '../../common/enums/pharmacy.enum';

/** Goods-receipt note: a supplier delivery. Posting it creates drug batches,
 * GRN_IN movements and adds to the supplier payable. */
@Entity('grns')
@Index('idx_grns_supplier_date', ['supplierId', 'receivedDate'])
@Index('idx_grns_status', ['status'])
export class Grn {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index('uq_grns_no', { unique: true })
  @Column({ type: 'varchar', length: 40 })
  grnNo: string;

  @Column({ type: 'bigint' })
  supplierId: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  invoiceNo: string | null;

  @Column({ type: 'date', nullable: true })
  invoiceDate: string | null;

  @Column({ type: 'date' })
  receivedDate: string;

  @Column({ type: 'enum', enum: GrnStatus, default: GrnStatus.DRAFT })
  status: GrnStatus;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  subtotal: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  gstAmount: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  total: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  postedByUserId: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
