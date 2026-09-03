import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CallKind } from '../../common/enums/field.enum';

@Entity('call_reports')
@Index('idx_call_reports_rep_date', ['repEmployeeId', 'callDate'])
@Index('idx_call_reports_date', ['callDate'])
@Index('idx_call_reports_doctor', ['doctorId'])
@Index('idx_call_reports_customer', ['customerId'])
export class CallReport {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  repEmployeeId: string;

  @Column({ type: 'date' })
  callDate: string;

  @Column({ type: 'enum', enum: CallKind })
  kind: CallKind;

  @Column({ type: 'bigint', nullable: true })
  doctorId: string | null;

  @Column({ type: 'bigint', nullable: true })
  customerId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  area: string | null;

  @Column({ type: 'boolean', default: false })
  wasPlanned: boolean;

  @Column({ type: 'bigint', nullable: true })
  jointWithEmployeeId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remarks: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  pobValue: string;

  @Column({ type: 'datetime', nullable: true })
  checkInAt: Date | null;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  latitude: string | null;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  longitude: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
