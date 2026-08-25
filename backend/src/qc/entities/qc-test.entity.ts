import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { QcSample } from './qc-sample.entity';
import { QcTestName, QcTestResultStatus } from '../../common/enums/qc.enum';

@Entity('qc_tests')
export class QcTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => QcSample, { eager: true })
  @JoinColumn({ name: 'sampleId' })
  sample: QcSample;

  @Column()
  sampleId: string;

  @Column({ type: 'enum', enum: QcTestName })
  testName: QcTestName;

  @Column()
  specificationText: string;

  @Column({ type: 'double', nullable: true })
  specMin: number | null;

  @Column({ type: 'double', nullable: true })
  specMax: number | null;

  @Column({ type: 'double', nullable: true })
  actualResultValue: number | null;

  @Column({ type: 'varchar', nullable: true })
  actualResultText: string | null;

  @Column({
    type: 'enum',
    enum: QcTestResultStatus,
    default: QcTestResultStatus.PENDING,
  })
  resultStatus: QcTestResultStatus;

  @Column({ type: 'varchar', nullable: true })
  testedByUserId: string | null;

  @Column({ type: 'datetime', nullable: true })
  testedDate: Date | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
