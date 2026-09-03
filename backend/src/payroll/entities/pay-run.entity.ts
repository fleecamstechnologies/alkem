import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PayRunStatus } from '../../common/enums/payroll.enum';

@Entity('pay_runs')
@Index('idx_pay_runs_status', ['status'])
export class PayRun {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index('uq_pay_runs_period', { unique: true })
  @Column({ type: 'varchar', length: 7 })
  periodMonth: string;

  @Column({ type: 'enum', enum: PayRunStatus, default: PayRunStatus.DRAFT })
  status: PayRunStatus;

  @Column({ type: 'date', nullable: true })
  runDate: string | null;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  totalGross: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  totalDeductions: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  totalNet: string;

  @Column({ type: 'int', default: 0 })
  employeeCount: number;

  @Column({ type: 'varchar', length: 36, nullable: true })
  processedByUserId: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  approvedByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
