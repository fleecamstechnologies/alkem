import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Batch } from '../../batches/entities/batch.entity';
import { QaDecision } from '../../common/enums/qa.enum';

@Entity('qa_reviews')
export class QaReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Batch, { eager: true })
  @JoinColumn({ name: 'batchId' })
  batch: Batch;

  @Column()
  batchId: string;

  @Column()
  reviewerUserId: string;

  @Column({ type: 'enum', enum: QaDecision })
  decision: QaDecision;

  @Column({ type: 'text' })
  comments: string;

  @CreateDateColumn()
  reviewedAt: Date;
}
