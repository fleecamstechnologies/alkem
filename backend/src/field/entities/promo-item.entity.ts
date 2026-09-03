import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PromoItemType } from '../../common/enums/field.enum';

@Entity('promo_items')
export class PromoItem {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index('uq_promo_items_code', { unique: true })
  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'enum', enum: PromoItemType })
  type: PromoItemType;

  @Column({ type: 'varchar', length: 20, default: 'unit' })
  unit: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
