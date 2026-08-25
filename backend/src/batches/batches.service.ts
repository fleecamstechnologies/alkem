import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Batch } from './entities/batch.entity';
import { CreateBatchDto } from './dto/create-batch.dto';
import { BatchStatus } from '../common/enums/batch-status.enum';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

const ALLOWED_TRANSITIONS: Record<BatchStatus, BatchStatus[]> = {
  [BatchStatus.CREATED]: [BatchStatus.MANUFACTURING],
  [BatchStatus.MANUFACTURING]: [BatchStatus.QC_PENDING],
  [BatchStatus.QC_PENDING]: [BatchStatus.QC_APPROVED, BatchStatus.REJECTED],
  [BatchStatus.QC_APPROVED]: [BatchStatus.QA_REVIEW],
  [BatchStatus.QA_REVIEW]: [BatchStatus.RELEASED, BatchStatus.REJECTED],
  [BatchStatus.RELEASED]: [],
  [BatchStatus.REJECTED]: [],
};

@Injectable()
export class BatchesService {
  constructor(
    @InjectRepository(Batch)
    private readonly batchesRepository: Repository<Batch>,
    private readonly auditService: AuditService,
  ) {}

  findAll(): Promise<Batch[]> {
    return this.batchesRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<Batch> {
    const batch = await this.batchesRepository.findOne({ where: { id } });
    if (!batch) {
      throw new NotFoundException(`Batch ${id} not found`);
    }
    return batch;
  }

  async create(dto: CreateBatchDto, actor: AuthenticatedUser): Promise<Batch> {
    const existing = await this.batchesRepository.findOne({
      where: { batchNumber: dto.batchNumber },
    });
    if (existing) {
      throw new ConflictException(
        `A batch with number ${dto.batchNumber} already exists`,
      );
    }

    const batch = this.batchesRepository.create({
      batchNumber: dto.batchNumber,
      productId: dto.productId,
      batchSize: dto.batchSize,
      manufacturingSite: dto.manufacturingSite,
      manufacturingDate: dto.manufacturingDate ?? null,
      status: BatchStatus.CREATED,
      createdByUserId: actor.userId,
    });
    const saved = await this.batchesRepository.save(batch);

    await this.auditService.record({
      entityName: 'Batch',
      entityId: saved.id,
      action: AuditAction.CREATE,
      user: actor,
    });

    return this.findById(saved.id);
  }

  /**
   * Also used internally by the QC and QA modules to advance a batch's
   * status once their own workflow reaches a decision point.
   */
  async transitionStatus(
    id: string,
    toStatus: BatchStatus,
    actor: AuthenticatedUser | null,
    reason?: string,
  ): Promise<Batch> {
    const batch = await this.findById(id);
    const allowed = ALLOWED_TRANSITIONS[batch.status];

    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(
        `Cannot transition batch from ${batch.status} to ${toStatus}`,
      );
    }

    const previousStatus = batch.status;
    batch.status = toStatus;
    const saved = await this.batchesRepository.save(batch);

    await this.auditService.record({
      entityName: 'Batch',
      entityId: saved.id,
      action: AuditAction.STATUS_CHANGE,
      user: actor,
      changes: { status: { old: previousStatus, new: toStatus } },
      reason,
    });

    return saved;
  }

  async startManufacturing(id: string, actor: AuthenticatedUser): Promise<Batch> {
    return this.transitionStatus(id, BatchStatus.MANUFACTURING, actor);
  }

  async submitForQc(
    id: string,
    productionQuantity: number,
    actor: AuthenticatedUser,
  ): Promise<Batch> {
    const batch = await this.transitionStatus(id, BatchStatus.QC_PENDING, actor);
    batch.productionQuantity = productionQuantity;
    return this.batchesRepository.save(batch);
  }
}
