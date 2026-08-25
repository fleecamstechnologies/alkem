import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QaReview } from './entities/qa-review.entity';
import { Deviation } from './entities/deviation.entity';
import { QaDecisionDto } from './dto/qa-decision.dto';
import { CreateDeviationDto } from './dto/create-deviation.dto';
import { CloseDeviationDto } from './dto/close-deviation.dto';
import { BatchStatus } from '../common/enums/batch-status.enum';
import { QaDecision, DeviationStatus } from '../common/enums/qa.enum';
import { BatchesService } from '../batches/batches.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class QaService {
  constructor(
    @InjectRepository(QaReview)
    private readonly reviewsRepository: Repository<QaReview>,
    @InjectRepository(Deviation)
    private readonly deviationsRepository: Repository<Deviation>,
    private readonly batchesService: BatchesService,
    private readonly auditService: AuditService,
  ) {}

  findReviewsForBatch(batchId: string): Promise<QaReview[]> {
    return this.reviewsRepository.find({
      where: { batchId },
      order: { reviewedAt: 'DESC' },
    });
  }

  async startReview(batchId: string, actor: AuthenticatedUser) {
    return this.batchesService.transitionStatus(batchId, BatchStatus.QA_REVIEW, actor);
  }

  async recordDecision(
    batchId: string,
    dto: QaDecisionDto,
    actor: AuthenticatedUser,
  ) {
    const batch = await this.batchesService.findById(batchId);
    if (batch.status !== BatchStatus.QA_REVIEW) {
      throw new BadRequestException(
        `Batch must be under QA review to record a decision (currently ${batch.status})`,
      );
    }

    const review = this.reviewsRepository.create({
      batchId,
      reviewerUserId: actor.userId,
      decision: dto.decision,
      comments: dto.comments,
    });
    const savedReview = await this.reviewsRepository.save(review);

    await this.auditService.record({
      entityName: 'QaReview',
      entityId: savedReview.id,
      action: AuditAction.CREATE,
      user: actor,
      reason: dto.comments,
    });

    const newStatus =
      dto.decision === QaDecision.RELEASED ? BatchStatus.RELEASED : BatchStatus.REJECTED;
    await this.batchesService.transitionStatus(batchId, newStatus, actor, dto.comments);

    return savedReview;
  }

  findAllDeviations(): Promise<Deviation[]> {
    return this.deviationsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findDeviationById(id: string): Promise<Deviation> {
    const deviation = await this.deviationsRepository.findOne({ where: { id } });
    if (!deviation) {
      throw new NotFoundException(`Deviation ${id} not found`);
    }
    return deviation;
  }

  async raiseDeviation(
    dto: CreateDeviationDto,
    actor: AuthenticatedUser,
  ): Promise<Deviation> {
    if (dto.batchId) {
      await this.batchesService.findById(dto.batchId);
    }

    const deviation = this.deviationsRepository.create({
      batchId: dto.batchId ?? null,
      department: dto.department,
      description: dto.description,
      severity: dto.severity,
      status: DeviationStatus.OPEN,
      raisedByUserId: actor.userId,
    });
    const saved = await this.deviationsRepository.save(deviation);

    await this.auditService.record({
      entityName: 'Deviation',
      entityId: saved.id,
      action: AuditAction.CREATE,
      user: actor,
    });

    return saved;
  }

  async closeDeviation(
    id: string,
    dto: CloseDeviationDto,
    actor: AuthenticatedUser,
  ): Promise<Deviation> {
    const deviation = await this.findDeviationById(id);
    if (deviation.status === DeviationStatus.CLOSED) {
      throw new BadRequestException('Deviation is already closed');
    }

    deviation.rootCause = dto.rootCause;
    deviation.correctiveAction = dto.correctiveAction;
    deviation.status = DeviationStatus.CLOSED;
    deviation.closedByUserId = actor.userId;
    deviation.closedAt = new Date();
    const saved = await this.deviationsRepository.save(deviation);

    await this.auditService.record({
      entityName: 'Deviation',
      entityId: saved.id,
      action: AuditAction.STATUS_CHANGE,
      user: actor,
      changes: { status: { old: DeviationStatus.OPEN, new: DeviationStatus.CLOSED } },
    });

    return saved;
  }
}
