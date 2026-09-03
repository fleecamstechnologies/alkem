import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Retail Chemist Prescription Audit line captured on a CHEMIST call. */
@Entity('call_rcpa')
@Index('idx_call_rcpa_report', ['callReportId'])
export class CallRcpa {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  callReportId: string;

  @Column({ type: 'varchar', length: 120 })
  brand: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  company: string | null;

  @Column({ type: 'int', default: 0 })
  units: number;

  @Column({ type: 'boolean', default: false })
  isOwn: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remarks: string | null;
}
