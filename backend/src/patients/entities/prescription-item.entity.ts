import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('prescription_items')
@Index('idx_rx_items_rx', ['prescriptionId'])
export class PrescriptionItem {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  prescriptionId: string;

  @Column({ type: 'varchar', length: 160 })
  drugName: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  strength: string | null;

  /** e.g. "1-0-1" */
  @Column({ type: 'varchar', length: 60, nullable: true })
  dosage: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  route: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  frequency: string | null;

  @Column({ type: 'int', nullable: true })
  durationDays: number | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  quantity: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  instructions: string | null;
}
