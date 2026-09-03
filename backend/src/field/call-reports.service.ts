import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CallReport } from './entities/call-report.entity';
import { CallProduct } from './entities/call-product.entity';
import { CallRcpa } from './entities/call-rcpa.entity';
import { CallRx } from './entities/call-rx.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { Customer } from '../customers/entities/customer.entity';
import { StockService } from './stock.service';
import {
  CallKind,
  CallProductAction,
  STOCK_ACTIONS,
  StockMovementKind,
} from '../common/enums/field.enum';
import { addMoney } from '../common/utils/money.util';
import {
  countWorkingDays,
  monthDateRange,
} from '../common/utils/working-days.util';
import { CreateCallReportDto } from './field.dto';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import type { Paginated, PaginationQuery } from '../common/dto/pagination';

@Injectable()
export class CallReportsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly stockService: StockService,
  ) {}

  async create(
    repEmployeeId: string,
    dto: CreateCallReportDto,
    actor: AuthenticatedUser,
  ): Promise<CallReport> {
    if (dto.kind === CallKind.DOCTOR && !dto.doctorId) {
      throw new BadRequestException('doctorId is required for a DOCTOR call');
    }
    if (dto.kind === CallKind.CHEMIST && !dto.customerId) {
      throw new BadRequestException('customerId is required for a CHEMIST call');
    }
    if (dto.doctorId) {
      const d = await this.ds
        .getRepository(Doctor)
        .findOne({ where: { id: String(dto.doctorId) }, select: ['id'] });
      if (!d) throw new BadRequestException(`Doctor ${dto.doctorId} not found`);
    }
    if (dto.customerId) {
      const c = await this.ds
        .getRepository(Customer)
        .findOne({ where: { id: String(dto.customerId) }, select: ['id'] });
      if (!c) {
        throw new BadRequestException(`Customer ${dto.customerId} not found`);
      }
    }

    let pob = '0.00';
    for (const p of dto.products ?? []) {
      if (p.action === CallProductAction.ORDER) {
        pob = addMoney(pob, p.value ?? '0');
      }
    }

    return this.ds.transaction(async (manager) => {
      const report = await manager.getRepository(CallReport).save(
        manager.getRepository(CallReport).create({
          repEmployeeId,
          callDate: dto.callDate,
          kind: dto.kind,
          doctorId: dto.doctorId ? String(dto.doctorId) : null,
          customerId: dto.customerId ? String(dto.customerId) : null,
          area: dto.area ?? null,
          wasPlanned: dto.wasPlanned ?? false,
          jointWithEmployeeId: dto.jointWithEmployeeId
            ? String(dto.jointWithEmployeeId)
            : null,
          remarks: dto.remarks ?? null,
          pobValue: pob,
          createdByUserId: actor.userId,
        }),
      );

      for (const p of dto.products ?? []) {
        await manager.getRepository(CallProduct).insert({
          callReportId: report.id,
          promoItemId: String(p.promoItemId),
          action: p.action,
          qty: p.qty ?? '0',
          value: p.value ?? '0',
          notes: p.notes ?? null,
        });
        if (STOCK_ACTIONS.includes(p.action) && Number(p.qty ?? 0) > 0) {
          await this.stockService.applyMovement(manager, {
            repEmployeeId,
            promoItemId: String(p.promoItemId),
            kind: StockMovementKind.DISTRIBUTE,
            signedQty: `-${p.qty}`,
            movementDate: dto.callDate,
            refType: 'CALL',
            refId: report.id,
            actorUserId: actor.userId,
          });
        }
      }

      for (const r of dto.rcpa ?? []) {
        await manager.getRepository(CallRcpa).insert({
          callReportId: report.id,
          brand: r.brand,
          company: r.company ?? null,
          units: r.units ?? 0,
          isOwn: r.isOwn ?? false,
          remarks: r.remarks ?? null,
        });
      }
      for (const r of dto.rx ?? []) {
        await manager.getRepository(CallRx).insert({
          callReportId: report.id,
          brand: r.brand,
          rxPerDay: r.rxPerDay ?? 0,
          remarks: r.remarks ?? null,
        });
      }

      return report;
    });
  }

  async list(
    filter: {
      repEmployeeId?: string | null;
      from?: string;
      to?: string;
      kind?: string;
      doctorId?: string;
    },
    query: PaginationQuery,
  ): Promise<Paginated<Record<string, unknown>>> {
    const limit = query.limit ?? 50;
    const where: string[] = [];
    const args: unknown[] = [];
    if (filter.repEmployeeId) {
      where.push('cr.repEmployeeId = ?');
      args.push(filter.repEmployeeId);
    }
    if (filter.from) {
      where.push('cr.callDate >= ?');
      args.push(filter.from);
    }
    if (filter.to) {
      where.push('cr.callDate <= ?');
      args.push(filter.to);
    }
    if (filter.kind) {
      where.push('cr.kind = ?');
      args.push(filter.kind);
    }
    if (filter.doctorId) {
      where.push('cr.doctorId = ?');
      args.push(filter.doctorId);
    }
    if (query.cursor) {
      where.push('cr.id < ?');
      args.push(query.cursor);
    }

    const rows: Array<Record<string, unknown>> = await this.ds.query(
      `SELECT cr.id, cr.repEmployeeId, cr.callDate, cr.kind, cr.wasPlanned,
              cr.pobValue, cr.area, cr.remarks,
              e.code AS repCode,
              DATE_FORMAT(cr.callDate,'%Y-%m-%d') AS callDate,
              COALESCE(d.name, c.name) AS partyName,
              COALESCE(d.code, c.code) AS partyCode,
              (SELECT COUNT(*) FROM call_products cp
                 WHERE cp.callReportId = cr.id AND cp.action IN ('SAMPLE','GIFT')) AS sampleLines
       FROM call_reports cr
       JOIN employees e ON e.id = cr.repEmployeeId
       LEFT JOIN doctors d ON d.id = cr.doctorId
       LEFT JOIN customers c ON c.id = cr.customerId
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY cr.id DESC
       LIMIT ?`,
      [...args, limit],
    );
    const nextCursor =
      rows.length === limit ? String(rows[rows.length - 1].id) : null;
    return { rows, nextCursor, total: null, limit };
  }

  async get(id: string) {
    const report = await this.ds
      .getRepository(CallReport)
      .findOne({ where: { id } });
    if (!report) throw new NotFoundException(`Call report ${id} not found`);
    const [products, rcpa, rx] = await Promise.all([
      this.ds.query(
        `SELECT cp.*, pi.code AS itemCode, pi.name AS itemName
         FROM call_products cp JOIN promo_items pi ON pi.id = cp.promoItemId
         WHERE cp.callReportId = ?`,
        [id],
      ),
      this.ds.getRepository(CallRcpa).find({ where: { callReportId: id } }),
      this.ds.getRepository(CallRx).find({ where: { callReportId: id } }),
    ]);
    let party: unknown = null;
    if (report.doctorId) {
      party = await this.ds
        .getRepository(Doctor)
        .findOne({ where: { id: report.doctorId } });
    } else if (report.customerId) {
      party = await this.ds
        .getRepository(Customer)
        .findOne({ where: { id: report.customerId } });
    }
    return { ...report, products, rcpa, rx, party };
  }

  /** Per-rep field KPIs for a month; rolls up when many rep ids are given. */
  async dashboard(periodMonth: string, repEmployeeIds: string[]) {
    if (repEmployeeIds.length === 0) {
      return { periodMonth, rows: [], totals: null };
    }
    const { from, to } = monthDateRange(periodMonth);
    const workingDays = countWorkingDays(from, to);
    const placeholders = repEmployeeIds.map(() => '?').join(',');

    const rows: Array<Record<string, string>> = await this.ds.query(
      `SELECT e.id AS repEmployeeId, e.code AS repCode,
              CONCAT(e.firstName,' ',e.lastName) AS repName,
              (SELECT COALESCE(SUM(d.plannedCalls),0)
                 FROM tour_plans tp JOIN tour_plan_days d ON d.tourPlanId = tp.id
                 WHERE tp.repEmployeeId = e.id AND tp.periodMonth = ?) AS planned,
              COUNT(cr.id) AS actual,
              COUNT(DISTINCT cr.doctorId) AS doctorsMet,
              COUNT(DISTINCT cr.customerId) AS chemistsMet,
              COALESCE(SUM(cr.pobValue),0) AS pobValue,
              (SELECT COUNT(*) FROM doctors dd
                 WHERE dd.assignedRepEmployeeId = e.id AND dd.deletedAt IS NULL) AS doctorsAssigned
       FROM employees e
       LEFT JOIN call_reports cr
         ON cr.repEmployeeId = e.id AND cr.callDate BETWEEN ? AND ?
       WHERE e.id IN (${placeholders})
       GROUP BY e.id
       ORDER BY e.code`,
      [periodMonth, from, to, ...repEmployeeIds],
    );

    const out = rows.map((r) => {
      const planned = Number(r.planned);
      const actual = Number(r.actual);
      const doctorsMet = Number(r.doctorsMet);
      const doctorsAssigned = Number(r.doctorsAssigned);
      return {
        repEmployeeId: r.repEmployeeId,
        repCode: r.repCode,
        repName: r.repName,
        planned,
        actual,
        compliancePct: planned ? Math.round((actual / planned) * 100) : null,
        workingDays,
        callAverage: workingDays
          ? Math.round((actual / workingDays) * 10) / 10
          : 0,
        doctorsMet,
        chemistsMet: Number(r.chemistsMet),
        doctorsAssigned,
        coveragePct: doctorsAssigned
          ? Math.round((doctorsMet / doctorsAssigned) * 100)
          : null,
        pobValue: r.pobValue,
      };
    });

    const totals = out.reduce(
      (acc, r) => ({
        planned: acc.planned + r.planned,
        actual: acc.actual + r.actual,
        pobValue: addMoney(acc.pobValue, r.pobValue),
      }),
      { planned: 0, actual: 0, pobValue: '0.00' },
    );

    return { periodMonth, workingDays, rows: out, totals };
  }
}
