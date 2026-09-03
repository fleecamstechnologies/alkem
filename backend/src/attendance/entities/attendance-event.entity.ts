import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PunchType } from '../../common/enums/attendance.enum';

/**
 * Append-only punch log — one row per punch/break event. The per-day
 * `attendance_records` row is recomputed from these. Partition-ready by
 * `eventDate`.
 */
@Entity('attendance_events')
@Index('idx_attendance_events_emp_date', ['employeeId', 'eventDate'])
@Index('idx_attendance_events_date', ['eventDate'])
export class AttendanceEvent {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  employeeId: string;

  @Column({ type: 'date' })
  eventDate: string;

  @Column({ type: 'datetime' })
  eventAt: Date;

  @Column({ type: 'enum', enum: PunchType })
  type: PunchType;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  @Column({ type: 'int', nullable: true })
  accuracyM: number | null;

  @Column({ type: 'bigint', nullable: true })
  officeId: string | null;

  @Column({ type: 'int', nullable: true })
  distanceM: number | null;

  @Column({ type: 'boolean', default: false })
  withinGeofence: boolean;

  @Column({ type: 'varchar', length: 20, default: 'WEB' })
  source: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
