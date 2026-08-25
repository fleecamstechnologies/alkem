import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Batch } from '../../batches/entities/batch.entity';
import { QcSampleStatus } from '../../common/enums/qc.enum';

@Entity('qc_samples')
export class QcSample {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Batch, { eager: true })
  @JoinColumn({ name: 'batchId' })
  batch: Batch;

  @Column()
  batchId: string;

  @Column()
  sampleType: string;

  @Column()
  sampleQuantity: number;

  @Column({ type: 'date' })
  collectionDate: string;

  @Column()
  analystUserId: string;

  @Column({ type: 'enum', enum: QcSampleStatus, default: QcSampleStatus.PENDING })
  status: QcSampleStatus;

  @CreateDateColumn()
  createdAt: Date;
}
