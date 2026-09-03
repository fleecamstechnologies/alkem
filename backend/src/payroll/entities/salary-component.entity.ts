import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  CalculationType,
  ComponentType,
} from '../../common/enums/payroll.enum';

@Entity('salary_components')
export class SalaryComponent {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index('uq_salary_components_code', { unique: true })
  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'enum', enum: ComponentType })
  type: ComponentType;

  @Column({ type: 'enum', enum: CalculationType, default: CalculationType.FIXED })
  calculationType: CalculationType;

  /** Amount for FIXED, percent (e.g. 40.00) for PERCENT_OF_BASIC. */
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  defaultValue: string;

  @Column({ type: 'boolean', default: true })
  taxable: boolean;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  /** BASIC and LOP are created by the system and cannot be deleted. */
  @Column({ type: 'boolean', default: false })
  system: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
