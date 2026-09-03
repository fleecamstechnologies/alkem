import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ComponentType } from '../../common/enums/payroll.enum';

@Entity('payslip_lines')
@Index('idx_payslip_lines_payslip', ['payslipId'])
export class PayslipLine {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  payslipId: string;

  @Column({ type: 'varchar', length: 30 })
  componentCode: string;

  @Column({ type: 'varchar', length: 80 })
  componentName: string;

  @Column({ type: 'enum', enum: ComponentType })
  type: ComponentType;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: string;
}
