import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DispenseStatus } from '../../common/enums/pharmacy.enum';

/** A pharmacy sale/issue against a patient. Posts a PHARMACY INVOICE on the
 * patient billing ledger; cancelling restores stock and voids that charge. */
@Entity('dispenses')
@Index('idx_dispenses_patient_at', ['patientId', 'dispensedAt'])
@Index('idx_dispenses_at', ['dispensedAt'])
@Index('idx_dispenses_rx', ['prescriptionId'])
export class Dispense {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index('uq_dispenses_no', { unique: true })
  @Column({ type: 'varchar', length: 40 })
  dispenseNo: string;

  @Column({ type: 'bigint' })
  patientId: string;

  @Column({ type: 'bigint', nullable: true })
  prescriptionId: string | null;

  @Column({ type: 'bigint', nullable: true })
  visitId: string | null;

  @Column({ type: 'enum', enum: DispenseStatus, default: DispenseStatus.DISPENSED })
  status: DispenseStatus;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  subtotal: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  discount: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  gstAmount: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  total: string;

  @Column({ type: 'bigint', nullable: true })
  patientChargeId: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  dispensedByUserId: string | null;

  @Column({ type: 'datetime' })
  dispensedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
