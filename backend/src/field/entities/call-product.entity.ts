import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { CallProductAction } from '../../common/enums/field.enum';

@Entity('call_products')
@Index('idx_call_products_report', ['callReportId'])
export class CallProduct {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  callReportId: string;

  @Column({ type: 'bigint' })
  promoItemId: string;

  @Column({ type: 'enum', enum: CallProductAction })
  action: CallProductAction;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  qty: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  value: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;
}
