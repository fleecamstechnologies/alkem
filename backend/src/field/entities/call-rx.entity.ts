import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Prescription capture from a DOCTOR call. */
@Entity('call_rx')
@Index('idx_call_rx_report', ['callReportId'])
export class CallRx {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  callReportId: string;

  @Column({ type: 'varchar', length: 120 })
  brand: string;

  @Column({ type: 'int', default: 0 })
  rxPerDay: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remarks: string | null;
}
