import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DrugForm } from '../../common/enums/pharmacy.enum';

@Entity('drugs')
@Index('ft_drugs_name', ['name'], { fulltext: true })
@Index('idx_drugs_active', ['isActive'])
export class Drug {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index('uq_drugs_code', { unique: true })
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  genericName: string | null;

  @Column({ type: 'enum', enum: DrugForm, default: DrugForm.TABLET })
  form: DrugForm;

  @Column({ type: 'varchar', length: 60, nullable: true })
  strength: string | null;

  @Column({ type: 'varchar', length: 40, default: 'unit' })
  unit: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  hsnCode: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  gstRate: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  mrp: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  purchasePrice: string;

  @Column({ type: 'int', default: 0 })
  reorderLevel: number;

  @Column({ type: 'varchar', length: 40, nullable: true })
  rackLocation: string | null;

  @Column({ type: 'boolean', default: false })
  scheduleH: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
