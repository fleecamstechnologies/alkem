import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  AttendanceSource,
  AttendanceStatus,
} from '../../common/enums/attendance.enum';

/**
 * One row per employee per day. High volume (~1.8M rows / 5k employees / year),
 * so: BIGINT PK, unique(employeeId, date) as the working index, (date, status)
 * for day summaries. No per-row audit. Partition-ready by `date` range.
 */
@Entity('attendance_records')
@Index('uq_attendance_employee_date', ['employeeId', 'date'], { unique: true })
@Index('idx_attendance_date_status', ['date', 'status'])
@Index('idx_attendance_leave_type', ['leaveTypeId'])
export class AttendanceRecord {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  employeeId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'enum', enum: AttendanceStatus })
  status: AttendanceStatus;

  @Column({ type: 'bigint', nullable: true })
  leaveTypeId: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  workedHours: string | null;

  /** First PUNCH_IN of the day (punch / regularization flows). */
  @Column({ type: 'datetime', nullable: true })
  firstInAt: Date | null;

  /** Last PUNCH_OUT of the day. */
  @Column({ type: 'datetime', nullable: true })
  lastOutAt: Date | null;

  @Column({ type: 'int', default: 0 })
  breakMinutes: number;

  @Column({
    type: 'enum',
    enum: AttendanceSource,
    default: AttendanceSource.MANUAL,
  })
  source: AttendanceSource;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
