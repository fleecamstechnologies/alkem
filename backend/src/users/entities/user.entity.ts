import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ type: 'varchar', length: 120, nullable: true })
  department: string | null;

  /** Links this login to an employee record for the self-service portal. */
  @Index('uq_users_employee', { unique: true })
  @Column({ type: 'bigint', nullable: true })
  employeeId: string | null;

  /** Links this login to a doctor record for the clinician view. */
  @Index('uq_users_doctor', { unique: true })
  @Column({ type: 'bigint', nullable: true })
  doctorId: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
