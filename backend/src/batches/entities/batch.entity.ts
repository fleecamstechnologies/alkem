import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { BatchStatus } from '../../common/enums/batch-status.enum';

@Entity('batches')
export class Batch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  batchNumber: string;

  @ManyToOne(() => Product, { eager: true })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  productId: string;

  @Column({ type: 'date', nullable: true })
  manufacturingDate: string | null;

  @Column()
  batchSize: number;

  @Column({ type: 'int', nullable: true })
  productionQuantity: number | null;

  @Column()
  manufacturingSite: string;

  @Column({ type: 'enum', enum: BatchStatus, default: BatchStatus.CREATED })
  status: BatchStatus;

  @Column()
  createdByUserId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
