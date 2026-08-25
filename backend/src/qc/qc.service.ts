import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QcSample } from './entities/qc-sample.entity';
import { QcTest } from './entities/qc-test.entity';
import { CreateSampleDto } from './dto/create-sample.dto';
import { AddTestDto } from './dto/add-test.dto';
import { RecordResultDto } from './dto/record-result.dto';
import { QcSampleStatus, QcTestResultStatus } from '../common/enums/qc.enum';
import { BatchStatus } from '../common/enums/batch-status.enum';
import { BatchesService } from '../batches/batches.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class QcService {
  constructor(
    @InjectRepository(QcSample)
    private readonly samplesRepository: Repository<QcSample>,
    @InjectRepository(QcTest)
    private readonly testsRepository: Repository<QcTest>,
    private readonly batchesService: BatchesService,
    private readonly auditService: AuditService,
  ) {}

  findAllSamples(): Promise<QcSample[]> {
    return this.samplesRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findSampleById(id: string): Promise<QcSample> {
    const sample = await this.samplesRepository.findOne({ where: { id } });
    if (!sample) {
      throw new NotFoundException(`QC sample ${id} not found`);
    }
    return sample;
  }

  findTestsForSample(sampleId: string): Promise<QcTest[]> {
    return this.testsRepository.find({
      where: { sampleId },
      order: { createdAt: 'ASC' },
    });
  }

  async createSample(dto: CreateSampleDto, actor: AuthenticatedUser): Promise<QcSample> {
    const batch = await this.batchesService.findById(dto.batchId);
    if (batch.status !== BatchStatus.QC_PENDING) {
      throw new BadRequestException(
        `Batch must be in ${BatchStatus.QC_PENDING} status to draw a QC sample (currently ${batch.status})`,
      );
    }

    const sample = this.samplesRepository.create({
      batchId: dto.batchId,
      sampleType: dto.sampleType,
      sampleQuantity: dto.sampleQuantity,
      collectionDate: dto.collectionDate,
      analystUserId: actor.userId,
      status: QcSampleStatus.PENDING,
    });
    const saved = await this.samplesRepository.save(sample);

    await this.auditService.record({
      entityName: 'QcSample',
      entityId: saved.id,
      action: AuditAction.CREATE,
      user: actor,
    });

    return this.findSampleById(saved.id);
  }

  async addTest(dto: AddTestDto, actor: AuthenticatedUser): Promise<QcTest> {
    const sample = await this.findSampleById(dto.sampleId);
    if (sample.status === QcSampleStatus.COMPLETED) {
      throw new BadRequestException('Cannot add tests to a completed sample');
    }

    const test = this.testsRepository.create({
      sampleId: dto.sampleId,
      testName: dto.testName,
      specificationText: dto.specificationText,
      specMin: dto.specMin ?? null,
      specMax: dto.specMax ?? null,
      resultStatus: QcTestResultStatus.PENDING,
    });
    const saved = await this.testsRepository.save(test);

    if (sample.status === QcSampleStatus.PENDING) {
      sample.status = QcSampleStatus.IN_PROGRESS;
      await this.samplesRepository.save(sample);
    }

    await this.auditService.record({
      entityName: 'QcTest',
      entityId: saved.id,
      action: AuditAction.CREATE,
      user: actor,
    });

    return saved;
  }

  async recordResult(
    testId: string,
    dto: RecordResultDto,
    actor: AuthenticatedUser,
  ): Promise<QcTest> {
    const test = await this.testsRepository.findOne({ where: { id: testId } });
    if (!test) {
      throw new NotFoundException(`QC test ${testId} not found`);
    }

    let resultStatus: QcTestResultStatus;
    if (
      test.specMin !== null &&
      test.specMax !== null &&
      dto.actualResultValue !== undefined
    ) {
      resultStatus =
        dto.actualResultValue >= test.specMin && dto.actualResultValue <= test.specMax
          ? QcTestResultStatus.PASS
          : QcTestResultStatus.FAIL;
    } else if (dto.manualPass !== undefined) {
      resultStatus = dto.manualPass ? QcTestResultStatus.PASS : QcTestResultStatus.FAIL;
    } else {
      throw new BadRequestException(
        'Provide actualResultValue (for numeric specs) or manualPass (for qualitative tests)',
      );
    }

    test.actualResultValue = dto.actualResultValue ?? null;
    test.actualResultText = dto.actualResultText ?? null;
    test.resultStatus = resultStatus;
    test.testedByUserId = actor.userId;
    test.testedDate = new Date();
    test.remarks = dto.remarks ?? null;

    const saved = await this.testsRepository.save(test);

    await this.auditService.record({
      entityName: 'QcTest',
      entityId: saved.id,
      action: AuditAction.UPDATE,
      user: actor,
      changes: { resultStatus: { old: QcTestResultStatus.PENDING, new: resultStatus } },
    });

    return saved;
  }

  async completeSample(sampleId: string, actor: AuthenticatedUser): Promise<QcSample> {
    const sample = await this.findSampleById(sampleId);
    const tests = await this.findTestsForSample(sampleId);

    if (tests.length === 0) {
      throw new BadRequestException('Add at least one test before completing the sample');
    }

    const pending = tests.filter((t) => t.resultStatus === QcTestResultStatus.PENDING);
    if (pending.length > 0) {
      throw new BadRequestException(
        `${pending.length} test(s) still pending a result`,
      );
    }

    sample.status = QcSampleStatus.COMPLETED;
    const saved = await this.samplesRepository.save(sample);

    await this.auditService.record({
      entityName: 'QcSample',
      entityId: saved.id,
      action: AuditAction.STATUS_CHANGE,
      user: actor,
      changes: { status: { old: QcSampleStatus.IN_PROGRESS, new: QcSampleStatus.COMPLETED } },
    });

    const allPassed = tests.every((t) => t.resultStatus === QcTestResultStatus.PASS);
    if (allPassed) {
      await this.batchesService.transitionStatus(
        sample.batchId,
        BatchStatus.QC_APPROVED,
        actor,
      );
    } else {
      const failedTests = tests
        .filter((t) => t.resultStatus === QcTestResultStatus.FAIL)
        .map((t) => t.testName)
        .join(', ');
      await this.batchesService.transitionStatus(
        sample.batchId,
        BatchStatus.REJECTED,
        actor,
        `QC failure: ${failedTests}`,
      );
    }

    return saved;
  }
}
