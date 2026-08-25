import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Batch } from '../../batches/entities/batch.entity';
import { DeviationSeverity, DeviationStatus } from '../../common/enums/qa.enum';

@Entity('deviations')
export class Deviation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Batch, { eager: true, nullable: true })
  @JoinColumn({ name: 'batchId' })
  batch: Batch | null;

  @Column({ type: 'varchar', nullable: true })
  batchId: string | null;

  @Column()
  department: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: DeviationSeverity })
  severity: DeviationSeverity;

  @Column({ type: 'enum', enum: DeviationStatus, default: DeviationStatus.OPEN })
  status: DeviationStatus;

  @Column()
  raisedByUserId: string;

  @Column({ type: 'text', nullable: true })
  rootCause: string | null;

  @Column({ type: 'text', nullable: true })
  correctiveAction: string | null;

  @Column({ type: 'varchar', nullable: true })
  closedByUserId: string | null;

  @Column({ type: 'datetime', nullable: true })
  closedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
