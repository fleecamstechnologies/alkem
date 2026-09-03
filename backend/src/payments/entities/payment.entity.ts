import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
} from '../../common/enums/payment.enum';

/**
 * One ledger entry against a customer (an invoice raised, a receipt collected,
 * a credit note, or a manual adjustment).
 *
 * Scale notes:
 *  - BIGINT PK, BIGINT customerId (matches customers.id) => tight joins.
 *  - idx_payments_customer_date covers the two hot reads: a customer's payment
 *    history and their statement, both ordered by (paymentDate, id).
 *  - idx_payments_date drives period/day summary GROUP BYs without touching rows.
 */
@Entity('payments')
@Index('idx_payments_customer_date', ['customerId', 'paymentDate', 'id'])
@Index('idx_payments_date', ['paymentDate'])
@Index('idx_payments_status', ['status'])
@Index('idx_payments_kind_date', ['kind', 'paymentDate'])
// MySQL keeps multiple NULLs in a unique index, so this only constrains rows
// that actually carry a referenceNo.
@Index('uq_payments_customer_ref', ['customerId', 'referenceNo'], { unique: true })
export class Payment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  customerId: string;

  @Column({ type: 'enum', enum: PaymentKind })
  kind: PaymentKind;

  /**
   * Always stored positive for INVOICE/RECEIPT/CREDIT_NOTE. ADJUSTMENT may be
   * negative. The sign that hits the balance is derived from `kind`.
   */
  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: string;

  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  method: PaymentMethod | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  referenceNo: string | null;

  @Column({ type: 'date' })
  paymentDate: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.CLEARED })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
