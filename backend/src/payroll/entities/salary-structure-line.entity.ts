import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CalculationType } from '../../common/enums/payroll.enum';

@Entity('employee_salary_structure_lines')
@Index('idx_essl_structure', ['structureId'])
export class SalaryStructureLine {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  structureId: string;

  @Column({ type: 'bigint' })
  componentId: string;

  @Column({ type: 'enum', enum: CalculationType })
  calculationType: CalculationType;

  /** Amount (FIXED) or percent (PERCENT_OF_BASIC). */
  @Column({ type: 'decimal', precision: 14, scale: 2 })
  value: string;

  /** Resolved monthly amount at assignment time. */
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  computedMonthly: string;
}
