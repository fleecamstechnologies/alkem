import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tour_plan_days')
@Index('idx_tour_plan_days_plan', ['tourPlanId'])
export class TourPlanDay {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  tourPlanId: string;

  @Column({ type: 'date' })
  planDate: string;

  @Column({ type: 'varchar', length: 120 })
  area: string;

  @Column({ type: 'int', default: 0 })
  plannedCalls: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;
}
