import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LeaveRequestStatus } from '../../common/enums/attendance.enum';

/**
 * An employee's request to have a day's attendance corrected (typically a
 * missed punch). Approved by the reporting manager; on approval the day's
 * `attendance_records` row is written from the requested in/out times.
 */
@Entity('attendance_regularizations')
@Index('idx_att_reg_emp_date', ['employeeId', 'date'])
@Index('idx_att_reg_status', ['status'])
export class AttendanceRegularization {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  employeeId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'datetime', nullable: true })
  requestedInAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  requestedOutAt: Date | null;

  @Column({ type: 'varchar', length: 500 })
  reason: string;

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
