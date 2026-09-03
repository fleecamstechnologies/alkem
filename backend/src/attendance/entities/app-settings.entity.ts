import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Single-row org settings for the attendance / punch module. Row id 1.
 */
@Entity('app_settings')
export class AppSettings {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  /** Worked hours at or above which a punched day counts as PRESENT. */
  @Column({ type: 'decimal', precision: 4, scale: 2, default: 4 })
  punchHalfDayHours: string;

  /** Reference full-day target (shown in the UI). */
  @Column({ type: 'decimal', precision: 4, scale: 2, default: 8 })
  punchFullDayHours: string;

  /** Default geofence radius suggested when creating a new office. */
  @Column({ type: 'int', default: 200 })
  defaultGeofenceMeters: number;

  @Column({ type: 'varchar', length: 36, nullable: true })
  updatedByUserId: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
