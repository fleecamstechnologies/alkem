import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StockMovementKind } from '../../common/enums/field.enum';

@Entity('stock_movements')
@Index('idx_stock_mov_rep_date', ['repEmployeeId', 'movementDate'])
@Index('idx_stock_mov_item', ['promoItemId'])
export class StockMovement {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  repEmployeeId: string;

  @Column({ type: 'bigint' })
  promoItemId: string;

  @Column({ type: 'enum', enum: StockMovementKind })
  kind: StockMovementKind;

  /** Signed: +issue, -distribute/-return, +/- adjust. */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  qty: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  refType: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  refId: string | null;

  @Column({ type: 'date' })
  movementDate: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
