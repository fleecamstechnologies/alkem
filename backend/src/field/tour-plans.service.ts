import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TourPlan } from './entities/tour-plan.entity';
import { TourPlanDay } from './entities/tour-plan-day.entity';
import { TourPlanStatus } from '../common/enums/field.enum';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import {
  DecideTourPlanDto,
  SetTourPlanDaysDto,
} from './field.dto';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class TourPlansService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async list(filter: {
    repEmployeeId?: string | null;
    periodMonth?: string;
    status?: string;
  }) {
    const where: string[] = [];
    const args: unknown[] = [];
    if (filter.repEmployeeId) {
      where.push('tp.repEmployeeId = ?');
      args.push(filter.repEmployeeId);
    }
    if (filter.periodMonth) {
      where.push('tp.periodMonth = ?');
      args.push(filter.periodMonth);
    }
    if (filter.status) {
      where.push('tp.status = ?');
      args.push(filter.status);
    }
    return this.ds.query(
      `SELECT tp.id, tp.repEmployeeId, tp.periodMonth, tp.status,
              tp.submittedAt, tp.decidedAt, tp.note,
              e.code AS repCode, CONCAT(e.firstName,' ',e.lastName) AS repName,
              (SELECT COUNT(*) FROM tour_plan_days d WHERE d.tourPlanId = tp.id) AS dayCount,
              (SELECT COALESCE(SUM(d.plannedCalls),0) FROM tour_plan_days d WHERE d.tourPlanId = tp.id) AS plannedCalls
       FROM tour_plans tp
       JOIN employees e ON e.id = tp.repEmployeeId
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY tp.periodMonth DESC, e.code
       LIMIT 300`,
      args,
    );
  }

  async get(id: string) {
    const plan = await this.ds
      .getRepository(TourPlan)
      .findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`Tour plan ${id} not found`);
    const days = await this.ds.getRepository(TourPlanDay).find({
      where: { tourPlanId: id },
      order: { planDate: 'ASC' },
    });
    return { ...plan, days };
  }

  async getOrCreate(repEmployeeId: string, periodMonth: string) {
    const repo = this.ds.getRepository(TourPlan);
    let plan = await repo.findOne({ where: { repEmployeeId, periodMonth } });
    if (!plan) {
      plan = await repo.save(
        repo.create({
          repEmployeeId,
          periodMonth,
          status: TourPlanStatus.DRAFT,
        }),
      );
    }
    return this.get(plan.id);
  }

  private async loadOwned(id: string, repEmployeeId: string): Promise<TourPlan> {
    const plan = await this.ds
      .getRepository(TourPlan)
      .findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`Tour plan ${id} not found`);
    if (String(plan.repEmployeeId) !== String(repEmployeeId)) {
      throw new ForbiddenException('Not your tour plan');
    }
    return plan;
  }

  async setDays(id: string, repEmployeeId: string, dto: SetTourPlanDaysDto) {
    const plan = await this.loadOwned(id, repEmployeeId);
    if (plan.status !== TourPlanStatus.DRAFT) {
      throw new BadRequestException('Only a DRAFT plan can be edited');
    }
    await this.ds.transaction(async (manager) => {
      await manager
        .getRepository(TourPlanDay)
        .delete({ tourPlanId: id });
      if (dto.days.length) {
        await manager.getRepository(TourPlanDay).insert(
          dto.days.map((d) => ({
            tourPlanId: id,
            planDate: d.planDate,
            area: d.area,
            plannedCalls: d.plannedCalls ?? 0,
            notes: d.notes ?? null,
          })),
        );
      }
    });
    return this.get(id);
  }

  async submit(id: string, repEmployeeId: string) {
    const plan = await this.loadOwned(id, repEmployeeId);
    if (plan.status !== TourPlanStatus.DRAFT) {
      throw new BadRequestException(`Cannot submit a ${plan.status} plan`);
    }
    plan.status = TourPlanStatus.SUBMITTED;
    plan.submittedAt = new Date();
    await this.ds.getRepository(TourPlan).save(plan);
    return this.get(id);
  }

  async decide(
    id: string,
    dto: DecideTourPlanDto,
    actor: AuthenticatedUser,
    canDecide: (repEmployeeId: string) => Promise<boolean>,
  ) {
    const plan = await this.ds
      .getRepository(TourPlan)
      .findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`Tour plan ${id} not found`);
    if (plan.status !== TourPlanStatus.SUBMITTED) {
      throw new BadRequestException(`Cannot decide a ${plan.status} plan`);
    }
    if (!(await canDecide(plan.repEmployeeId))) {
      throw new ForbiddenException('You cannot decide this rep’s tour plan');
    }
    const from = plan.status;
    plan.status = dto.decision;
    plan.decidedByUserId = actor.userId;
    plan.decidedAt = new Date();
    plan.note = dto.note ?? plan.note;
    await this.ds.getRepository(TourPlan).save(plan);
    await this.auditService.record({
      entityName: 'TourPlan',
      entityId: id,
      action: AuditAction.STATUS_CHANGE,
      user: actor,
      changes: { status: { old: from, new: dto.decision } },
      reason: dto.note,
    });
    return this.get(id);
  }
}
