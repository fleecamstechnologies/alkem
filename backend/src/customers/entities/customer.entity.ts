import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CustomerStatus, CustomerType } from '../../common/enums/customer.enum';

/**
 * Customer master. Designed to stay fast at 2M+ rows:
 *  - BIGINT auto-increment PK => compact append-only clustered index.
 *  - outstandingBalance is denormalised and maintained transactionally by the
 *    payments module, so a customer's balance never needs a SUM() over payments.
 *  - name has a FULLTEXT index for search (never LIKE '%...%').
 *
 * Future: if a single table gets unwieldy, MySQL `PARTITION BY KEY(state)` or by
 * a hash of id can be added without an app-level change.
 */
@Entity('customers')
@Index('idx_customers_status_id', ['status', 'id'])
@Index('idx_customers_city_state', ['city', 'state'])
@Index('idx_customers_territory', ['territory'])
@Index('idx_customers_phone', ['phone'])
@Index('idx_customers_assigned_rep', ['assignedRepId'])
@Index('idx_customers_assigned_rep_emp', ['assignedRepEmployeeId'])
@Index('ft_customers_name', ['name'], { fulltext: true })
export class Customer {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index('uq_customers_code', { unique: true })
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'enum', enum: CustomerType, default: CustomerType.CHEMIST })
  type: CustomerType;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gstin: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  addressLine1: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  addressLine2: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 12, nullable: true })
  pincode: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  territory: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  assignedRepId: string | null;

  /** Field rep (employee id) responsible for calling on this chemist/stockist. */
  @Column({ type: 'bigint', nullable: true })
  assignedRepEmployeeId: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  creditLimit: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  outstandingBalance: string;

  @Column({ type: 'enum', enum: CustomerStatus, default: CustomerStatus.ACTIVE })
  status: CustomerStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
