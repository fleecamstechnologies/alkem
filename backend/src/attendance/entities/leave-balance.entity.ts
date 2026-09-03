import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('leave_balances')
@Index('uq_leave_balances', ['employeeId', 'leaveTypeId', 'year'], {
  unique: true,
})
export class LeaveBalance {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  employeeId: string;

  @Column({ type: 'bigint' })
  leaveTypeId: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  entitled: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  used: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  pending: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
