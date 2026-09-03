import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Marks an employee as a medical representative + their patch. */
@Entity('field_reps')
export class FieldRep {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index('uq_field_reps_employee', { unique: true })
  @Column({ type: 'bigint' })
  employeeId: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  hq: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  territory: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
