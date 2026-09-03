import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LeaveRequestStatus } from '../../common/enums/attendance.enum';

@Entity('leave_requests')
@Index('idx_leave_requests_employee', ['employeeId', 'fromDate'])
@Index('idx_leave_requests_status', ['status'])
@Index('idx_leave_requests_range', ['fromDate', 'toDate'])
export class LeaveRequest {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  employeeId: string;

  @Column({ type: 'bigint' })
  leaveTypeId: string;

  @Column({ type: 'date' })
  fromDate: string;

  @Column({ type: 'date' })
  toDate: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  days: string;

  @Column({ type: 'boolean', default: false })
  halfDay: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @Column({
    type: 'enum',
    enum: LeaveRequestStatus,
    default: LeaveRequestStatus.PENDING,
  })
  status: LeaveRequestStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  decidedByUserId: string | null;

  @Column({ type: 'datetime', nullable: true })
  decidedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  decisionNote: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
