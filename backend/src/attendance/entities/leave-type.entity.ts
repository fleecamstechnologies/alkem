import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('leave_types')
export class LeaveType {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index('uq_leave_types_code', { unique: true })
  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  /** false => leave without pay; feeds LOP in payroll. */
  @Column({ type: 'boolean', default: true })
  paid: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  annualQuota: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
