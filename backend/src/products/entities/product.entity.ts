import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  productCode: string;

  @Column()
  productName: string;

  @Column()
  genericName: string;

  @Column({ type: 'varchar', nullable: true })
  brandName: string | null;

  @Column()
  composition: string;

  @Column()
  strength: string;

  @Column()
  dosageForm: string;

  @Column()
  packSize: string;

  @Column()
  manufacturingSite: string;

  @Column({ type: 'varchar', nullable: true })
  storageCondition: string | null;

  @Column({ type: 'int', nullable: true })
  shelfLifeMonths: number | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
