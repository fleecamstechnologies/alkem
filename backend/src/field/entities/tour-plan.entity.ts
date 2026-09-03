import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TourPlanStatus } from '../../common/enums/field.enum';

@Entity('tour_plans')
@Index('uq_tour_plans_rep_month', ['repEmployeeId', 'periodMonth'], {
  unique: true,
})
export class TourPlan {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  repEmployeeId: string;

  @Column({ type: 'varchar', length: 7 })
  periodMonth: string;

  @Column({
    type: 'enum',
    enum: TourPlanStatus,
    default: TourPlanStatus.DRAFT,
  })
  status: TourPlanStatus;

  @Column({ type: 'datetime', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  decidedByUserId: string | null;

  @Column({ type: 'datetime', nullable: true })
  decidedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
