import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('holidays')
export class Holiday {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index('uq_holidays_date', { unique: true })
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;
}
