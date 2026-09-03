import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  ChargeKind,
  ChargeMethod,
  ChargeStatus,
  ServiceKind,
} from '../../common/enums/patient.enum';

/**
 * Patient billing ledger. INVOICE increases what the patient owes; PAYMENT /
 * REFUND decrease it. `patients.outstandingBalance` is the denormalised running
 * total, maintained transactionally. Partition-ready by `chargeDate`.
 */
@Entity('patient_charges')
@Index('idx_pcharge_patient_date', ['patientId', 'chargeDate', 'id'])
@Index('idx_pcharge_date', ['chargeDate'])
@Index('idx_pcharge_status', ['status'])
@Index('idx_pcharge_service_date', ['serviceKind', 'chargeDate'])
export class PatientCharge {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  patientId: string;

  @Column({ type: 'enum', enum: ChargeKind })
  kind: ChargeKind;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: string;

  @Column({ type: 'enum', enum: ChargeMethod, nullable: true })
  method: ChargeMethod | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  reference: string | null;

  @Column({ type: 'date' })
  chargeDate: string;

  @Column({ type: 'enum', enum: ServiceKind, nullable: true })
  serviceKind: ServiceKind | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'bigint', nullable: true })
  visitId: string | null;

  @Column({ type: 'enum', enum: ChargeStatus, default: ChargeStatus.CLEARED })
  status: ChargeStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
