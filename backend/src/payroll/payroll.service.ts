import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { SalaryComponent } from './entities/salary-component.entity';
import { EmployeeSalaryStructure } from './entities/employee-salary-structure.entity';
import { SalaryStructureLine } from './entities/salary-structure-line.entity';
import { PayRun } from './entities/pay-run.entity';
import { Payslip } from './entities/payslip.entity';
import { PayslipLine } from './entities/payslip-line.entity';
import { PayslipStatutory } from './entities/payslip-statutory.entity';
import { TaxDeclaration } from './entities/tax-declaration.entity';
import {
  AssignStructureDto,
  CreateComponentDto,
  UpdateComponentDto,
} from './dto/payroll.dto';
import { UpsertTaxDeclarationDto } from './dto/statutory.dto';
import {
  CalculationType,
  ComponentType,
  DeclarationStatus,
  PayRunStatus,
  PayslipStatus,
  STATUTORY_CODES,
  TaxRegime,
} from '../common/enums/payroll.enum';
import { PaginationQuery, Paginated } from '../common/dto/pagination';
import { EmployeesService } from '../employees/employees.service';
import { AttendanceService } from '../attendance/attendance.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { fromPaise, percentOfPaise, toPaise } from '../common/utils/money.util';
import { daysInMonth } from '../common/utils/working-days.util';
import { StatutoryConfigService } from './statutory-config.service';
import { EmployeeStatutoryService } from './employee-statutory.service';
import { StatutoryService, type StatutoryYtd } from './statutory.service';
import { TaxService } from './tax.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

const RUN_TRANSITIONS: Record<PayRunStatus, PayRunStatus[]> = {
  [PayRunStatus.DRAFT]: [PayRunStatus.PROCESSED, PayRunStatus.CANCELLED],
  [PayRunStatus.PROCESSED]: [
    PayRunStatus.PROCESSED,
    PayRunStatus.APPROVED,
    PayRunStatus.CANCELLED,
  ],
  [PayRunStatus.APPROVED]: [PayRunStatus.PAID, PayRunStatus.CANCELLED],
  [PayRunStatus.PAID]: [],
  [PayRunStatus.CANCELLED]: [],
};

@Injectable()
export class PayrollService {
  constructor(
    @InjectRepository(SalaryComponent)
    private readonly componentRepo: Repository<SalaryComponent>,
    @InjectRepository(EmployeeSalaryStructure)
    private readonly structureRepo: Repository<EmployeeSalaryStructure>,
    @InjectRepository(SalaryStructureLine)
    private readonly lineRepo: Repository<SalaryStructureLine>,
    @InjectRepository(PayRun)
    private readonly runRepo: Repository<PayRun>,
    @InjectRepository(Payslip)
    private readonly payslipRepo: Repository<Payslip>,
    @InjectRepository(PayslipLine)
    private readonly payslipLineRepo: Repository<PayslipLine>,
    @InjectRepository(PayslipStatutory)
    private readonly payslipStatutoryRepo: Repository<PayslipStatutory>,
    @InjectRepository(TaxDeclaration)
    private readonly taxDeclarationRepo: Repository<TaxDeclaration>,
    private readonly dataSource: DataSource,
    private readonly employeesService: EmployeesService,
    private readonly attendanceService: AttendanceService,
    private readonly auditService: AuditService,
    private readonly statutoryConfigService: StatutoryConfigService,
    private readonly employeeStatutoryService: EmployeeStatutoryService,
    private readonly statutoryService: StatutoryService,
    private readonly taxService: TaxService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // ---- components -------------------------------------------------

  listComponents(): Promise<SalaryComponent[]> {
    return this.componentRepo.find({ order: { type: 'ASC', code: 'ASC' } });
  }

  async createComponent(dto: CreateComponentDto): Promise<SalaryComponent> {
    const existing = await this.componentRepo.findOne({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Component ${dto.code} already exists`);
    }
    return this.componentRepo.save(
      this.componentRepo.create({
        code: dto.code,
        name: dto.name,
        type: dto.type,
        calculationType: dto.calculationType,
        defaultValue: dto.defaultValue ?? '0',
        taxable: dto.taxable ?? true,
        active: dto.active ?? true,
        system: false,
      }),
    );
  }

  async updateComponent(
    id: string,
    dto: UpdateComponentDto,
  ): Promise<SalaryComponent> {
    const c = await this.componentRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`Component ${id} not found`);
    Object.assign(c, {
      name: dto.name ?? c.name,
      defaultValue: dto.defaultValue ?? c.defaultValue,
      taxable: dto.taxable ?? c.taxable,
      active: dto.active ?? c.active,
    });
    return this.componentRepo.save(c);
  }

  async deleteComponent(id: string): Promise<void> {
    const c = await this.componentRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`Component ${id} not found`);
    if (c.system) {
      throw new BadRequestException('system components cannot be deleted');
    }
    const used = await this.lineRepo.count({ where: { componentId: id } });
    if (used > 0) {
      throw new BadRequestException(
        'component is used by a salary structure; deactivate it instead',
      );
    }
    await this.componentRepo.delete(id);
  }

  // ---- salary structures ---------------------------------------

  async getActiveStructure(employeeId: string) {
    const structure = await this.structureRepo.findOne({
      where: { employeeId, active: true },
    });
    if (!structure) return null;
    const lines = await this.lineRepo.find({
      where: { structureId: structure.id },
    });
    const components = await this.componentRepo.find();
    const byId = new Map(components.map((c) => [c.id, c]));
    return {
      ...structure,
      lines: lines.map((l) => ({
        ...l,
        component: byId.get(l.componentId) ?? null,
      })),
    };
  }

  async assignStructure(
    employeeId: string,
    dto: AssignStructureDto,
    actor: AuthenticatedUser,
  ) {
    await this.employeesService.findById(employeeId);
    const basicPaise = toPaise(dto.basicMonthly);

    const components = dto.lines.length
      ? await this.componentRepo.find({
          where: { id: In(dto.lines.map((l) => String(l.componentId))) },
        })
      : [];
    const byId = new Map(components.map((c) => [c.id, c]));

    let earningsPaise = basicPaise;
    const resolved = dto.lines.map((l) => {
      const component = byId.get(String(l.componentId));
      if (!component) {
        throw new BadRequestException(`unknown component ${l.componentId}`);
      }
      if (STATUTORY_CODES.has(component.code)) {
        throw new BadRequestException(
          `${component.code} is computed automatically by the statutory engine — remove it from the structure`,
        );
      }
      const computedPaise =
        l.calculationType === CalculationType.FIXED
          ? toPaise(l.value)
          : percentOfPaise(basicPaise, l.value);
      if (component.type === ComponentType.EARNING) {
        earningsPaise += computedPaise;
      }
      return {
        componentId: component.id,
        calculationType: l.calculationType,
        value: l.value,
        computedMonthly: fromPaise(computedPaise),
      };
    });

    return this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(EmployeeSalaryStructure)
        .update({ employeeId, active: true }, { active: false });

      const structure = await manager.getRepository(EmployeeSalaryStructure).save(
        manager.getRepository(EmployeeSalaryStructure).create({
          employeeId,
          effectiveFrom: dto.effectiveFrom,
          basicMonthly: fromPaise(basicPaise),
          grossMonthly: fromPaise(earningsPaise),
          active: true,
          note: dto.note ?? null,
          createdByUserId: actor.userId,
        }),
      );

      if (resolved.length > 0) {
        await manager
          .getRepository(SalaryStructureLine)
          .insert(resolved.map((r) => ({ ...r, structureId: structure.id })));
      }

      await this.auditService.record({
        entityName: 'EmployeeSalaryStructure',
        entityId: structure.id,
        action: AuditAction.CREATE,
        user: actor,
      });

      return structure;
    });
  }

  // ---- pay runs -----------------------------------------------

  listRuns(): Promise<PayRun[]> {
    return this.runRepo.find({ order: { periodMonth: 'DESC' }, take: 60 });
  }

  async getRun(id: string): Promise<PayRun> {
    const run = await this.runRepo.findOne({ where: { id } });
    if (!run) throw new NotFoundException(`Pay run ${id} not found`);
    return run;
  }

  async createRun(
    periodMonth: string,
    actor: AuthenticatedUser,
  ): Promise<PayRun> {
    const existing = await this.runRepo.findOne({ where: { periodMonth } });
    if (existing) {
      throw new ConflictException(`Pay run for ${periodMonth} already exists`);
    }
    const run = await this.runRepo.save(
      this.runRepo.create({ periodMonth, status: PayRunStatus.DRAFT }),
    );
    await this.auditService.record({
      entityName: 'PayRun',
      entityId: run.id,
      action: AuditAction.CREATE,
      user: actor,
    });
    return run;
  }

  private assertTransition(from: PayRunStatus, to: PayRunStatus): void {
    if (!RUN_TRANSITIONS[from].includes(to)) {
      throw new BadRequestException(
        `cannot move pay run from ${from} to ${to}`,
      );
    }
  }

  // ---- statutory helpers ----------------------------------------

  private async loadDeclarations(
    employeeIds: string[],
    financialYear: string,
  ): Promise<Map<string, TaxDeclaration>> {
    if (!employeeIds.length) return new Map();
    const rows = await this.taxDeclarationRepo.find({
      where: { employeeId: In(employeeIds), financialYear },
    });
    return new Map(rows.map((r) => [r.employeeId, r]));
  }

  /** Sum of gross / TDS / PT / employee-EPF paid so far this FY (months < the
   * one being processed). One grouped query per aggregate, keyed by employeeId. */
  private async loadYtd(
    employeeIds: string[],
    financialYear: string,
    periodMonth: string,
  ): Promise<Map<string, StatutoryYtd>> {
    const map = new Map<string, StatutoryYtd>();
    if (!employeeIds.length) return map;
    const startYear = Number(financialYear.split('-')[0]);
    const fyStart = `${startYear}-04`;
    const ph = employeeIds.map(() => '?').join(',');

    const base: Array<{
      eid: string;
      grossPaid: string;
      tdsPaid: string;
    }> = await this.dataSource.query(
      `SELECT p.employeeId AS eid,
              COALESCE(SUM(p.grossEarnings), 0) AS grossPaid,
              COALESCE(SUM(p.tdsAmount), 0) AS tdsPaid
       FROM payslips p
       WHERE p.employeeId IN (${ph})
         AND p.periodMonth >= ? AND p.periodMonth < ?
       GROUP BY p.employeeId`,
      [...employeeIds, fyStart, periodMonth],
    );
    const byLine: Array<{
      eid: string;
      ptPaid: string;
      pfPaid: string;
    }> = await this.dataSource.query(
      `SELECT p.employeeId AS eid,
              COALESCE(SUM(CASE WHEN pl.componentCode = 'PT' THEN pl.amount ELSE 0 END), 0) AS ptPaid,
              COALESCE(SUM(CASE WHEN pl.componentCode = 'EPF' THEN pl.amount ELSE 0 END), 0) AS pfPaid
       FROM payslip_lines pl
       JOIN payslips p ON p.id = pl.payslipId
       WHERE p.employeeId IN (${ph})
         AND p.periodMonth >= ? AND p.periodMonth < ?
         AND pl.componentCode IN ('PT', 'EPF')
       GROUP BY p.employeeId`,
      [...employeeIds, fyStart, periodMonth],
    );
    const lineById = new Map(byLine.map((r) => [String(r.eid), r]));
    for (const r of base) {
      const l = lineById.get(String(r.eid));
      map.set(String(r.eid), {
        grossPaid: String(r.grossPaid),
        tdsPaid: String(r.tdsPaid),
        ptPaid: l ? String(l.ptPaid) : '0',
        pfEmployeePaid: l ? String(l.pfPaid) : '0',
      });
    }
    return map;
  }

  // ---- tax declarations ---------------------------------------

  private async ensureDeclaration(
    employeeId: string,
    financialYear: string,
  ): Promise<TaxDeclaration> {
    let row = await this.taxDeclarationRepo.findOne({
      where: { employeeId, financialYear },
    });
    if (!row) {
      row = await this.taxDeclarationRepo.save(
        this.taxDeclarationRepo.create({ employeeId, financialYear }),
      );
    }
    return row;
  }

  async getTaxDeclaration(employeeId: string, financialYear: string) {
    await this.employeesService.findById(employeeId);
    const declaration = await this.ensureDeclaration(employeeId, financialYear);
    const [projection, regimeComparison] = await Promise.all([
      this.taxProjection(employeeId, financialYear, declaration),
      this.regimeComparison(employeeId, financialYear, declaration),
    ]);
    return { declaration, projection, regimeComparison };
  }

  async upsertTaxDeclaration(
    employeeId: string,
    financialYear: string,
    dto: UpsertTaxDeclarationDto,
    actor: AuthenticatedUser,
    allowLock: boolean,
  ) {
    const row = await this.ensureDeclaration(employeeId, financialYear);
    if (row.status === DeclarationStatus.LOCKED) {
      throw new BadRequestException(
        'This declaration is locked by HR and can no longer be changed',
      );
    }
    const { status, ...fields } = dto;
    Object.assign(row, fields);
    if (status === DeclarationStatus.LOCKED) {
      if (!allowLock) {
        throw new BadRequestException('Only HR can lock a declaration');
      }
      row.status = DeclarationStatus.LOCKED;
      row.lockedByUserId = actor.userId;
    } else {
      row.status = DeclarationStatus.SUBMITTED;
      row.submittedAt = new Date();
    }
    const saved = await this.taxDeclarationRepo.save(row);
    await this.auditService.record({
      entityName: 'TaxDeclaration',
      entityId: saved.id,
      action: AuditAction.UPDATE,
      user: actor,
      reason: saved.status,
    });
    return this.getTaxDeclaration(employeeId, financialYear);
  }

  /** Run the annual-tax engine against the current declaration + salary. */
  async taxProjection(
    employeeId: string,
    financialYear: string,
    declaration?: TaxDeclaration | null,
  ) {
    const decl =
      declaration ??
      (await this.taxDeclarationRepo.findOne({
        where: { employeeId, financialYear },
      }));
    const regime = decl?.regime ?? TaxRegime.NEW;
    const [config, slabs, structure] = await Promise.all([
      this.statutoryConfigService.getActiveConfig(),
      this.statutoryConfigService.slabsFor(financialYear, regime),
      this.structureRepo.findOne({
        where: { employeeId, active: true },
      }),
    ]);
    if (!structure) return null;

    const basicP = toPaise(structure.basicMonthly);
    const structLines = await this.lineRepo.find({
      where: { structureId: structure.id },
    });
    const comps = await this.componentRepo.find();
    const compById = new Map(comps.map((c) => [c.id, c]));
    let hraAnnualP = 0n;
    for (const sl of structLines) {
      const c = compById.get(sl.componentId);
      if (c?.code === 'HRA') hraAnnualP += toPaise(sl.computedMonthly) * 12n;
    }
    const annualGrossP = toPaise(structure.grossMonthly) * 12n;
    const pfEmployeeAnnualP = percentOfPaise(
      basicP < toPaise(config.pfWageCeiling) ||
        !config.pfCapAtCeilingDefault
        ? basicP
        : toPaise(config.pfWageCeiling),
      config.pfEmployeeRate,
    ) * 12n;

    return this.taxService.computeAnnualTax({
      regime,
      annualGross: annualGrossP,
      annualBasic: basicP * 12n,
      annualHra: hraAnnualP,
      ptAnnual: 0n,
      pfEmployeeAnnual: pfEmployeeAnnualP,
      declaration: decl ?? null,
      config,
      slabs,
    });
  }

  private async regimeComparison(
    employeeId: string,
    financialYear: string,
    declaration: TaxDeclaration,
  ) {
    const old = await this.taxProjection(employeeId, financialYear, {
      ...declaration,
      regime: TaxRegime.OLD,
    } as TaxDeclaration);
    const neu = await this.taxProjection(employeeId, financialYear, {
      ...declaration,
      regime: TaxRegime.NEW,
    } as TaxDeclaration);
    return { old, new: neu };
  }

  async processRun(id: string, actor: AuthenticatedUser): Promise<PayRun> {
    const run = await this.getRun(id);
    this.assertTransition(run.status, PayRunStatus.PROCESSED);

    const periodMonth = run.periodMonth;
    const totalDays = daysInMonth(periodMonth);
    const employees = await this.employeesService.findActive();
    const allComponents = await this.componentRepo.find();
    const componentById = new Map(allComponents.map((c) => [c.id, c]));

    // ---- statutory context (loaded once per run) ------------------
    const empIds = employees.map((e) => e.id);
    const fy = StatutoryConfigService.financialYearOf(periodMonth);
    const [config, ptSlabs, slabsOld, slabsNew, profileMap, declMap, ytdMap] =
      await Promise.all([
        this.statutoryConfigService.getActiveConfig(),
        this.statutoryConfigService.listPtSlabs(),
        this.statutoryConfigService.slabsFor(fy, TaxRegime.OLD),
        this.statutoryConfigService.slabsFor(fy, TaxRegime.NEW),
        this.employeeStatutoryService.ensureProfiles(empIds),
        this.loadDeclarations(empIds, fy),
        this.loadYtd(empIds, fy, periodMonth),
      ]);

    interface Draft {
      payslip: Partial<Payslip>;
      lines: Omit<PayslipLine, 'id' | 'payslipId'>[];
      statutory: Omit<
        PayslipStatutory,
        'id' | 'payslipId' | 'createdAt'
      >;
    }
    const drafts: Draft[] = [];
    let skipped = 0;

    for (const emp of employees) {
      const structure = await this.structureRepo.findOne({
        where: { employeeId: emp.id, active: true },
      });
      if (!structure) {
        skipped += 1;
        continue;
      }
      const structLines = await this.lineRepo.find({
        where: { structureId: structure.id },
      });

      const basicPaise = toPaise(structure.basicMonthly);
      const lines: Omit<PayslipLine, 'id' | 'payslipId'>[] = [
        {
          componentCode: 'BASIC',
          componentName: 'Basic',
          type: ComponentType.EARNING,
          amount: fromPaise(basicPaise),
        },
      ];

      let earningsPaise = basicPaise;
      let deductionsPaise = 0n;
      let hraPaise = 0n;
      for (const sl of structLines) {
        const comp = componentById.get(sl.componentId);
        if (!comp) continue;
        // The statutory engine owns EPF/ESI/PT/TDS + employer codes.
        if (STATUTORY_CODES.has(comp.code)) continue;
        const amtPaise = toPaise(sl.computedMonthly);
        lines.push({
          componentCode: comp.code,
          componentName: comp.name,
          type: comp.type,
          amount: fromPaise(amtPaise),
        });
        if (comp.type === ComponentType.EARNING) {
          earningsPaise += amtPaise;
          if (comp.code === 'HRA') hraPaise += amtPaise;
        } else if (comp.type === ComponentType.DEDUCTION) {
          deductionsPaise += amtPaise;
        }
      }

      const grossEarningsPaise = earningsPaise;

      const lopDays = await this.attendanceService.lopDaysFor(
        emp.id,
        periodMonth,
      );
      const paidDays = Math.max(0, totalDays - lopDays);
      let lopPaise = 0n;
      if (lopDays > 0) {
        lopPaise =
          (earningsPaise * BigInt(Math.round(lopDays * 100))) /
          BigInt(totalDays * 100);
        lines.push({
          componentCode: 'LOP',
          componentName: 'Loss of Pay',
          type: ComponentType.DEDUCTION,
          amount: fromPaise(lopPaise),
        });
        deductionsPaise += lopPaise;
      }

      // ---- statutory deductions + employer contributions ----------
      const profile = profileMap.get(emp.id)!;
      const declaration = declMap.get(emp.id) ?? null;
      const regime = declaration?.regime ?? TaxRegime.NEW;
      const st = this.statutoryService.computeForPayslip({
        profile,
        config,
        declaration,
        slabs: regime === TaxRegime.OLD ? slabsOld : slabsNew,
        ptSlabs,
        basicMonthly: structure.basicMonthly,
        hraMonthly: fromPaise(hraPaise),
        grossEarningsMonthly: fromPaise(grossEarningsPaise),
        totalDaysInMonth: totalDays,
        paidDays,
        lopDays,
        periodMonth,
        ytd: ytdMap.get(emp.id) ?? {
          grossPaid: '0',
          tdsPaid: '0',
          ptPaid: '0',
          pfEmployeePaid: '0',
        },
      });

      let employerPaise = 0n;
      for (const l of st.deductionLines) {
        lines.push(l);
        deductionsPaise += toPaise(l.amount);
      }
      for (const l of st.employerLines) {
        lines.push(l);
        employerPaise += toPaise(l.amount);
      }

      const netPaise = earningsPaise - deductionsPaise;
      const ctcPaise = earningsPaise + employerPaise;
      drafts.push({
        payslip: {
          payRunId: run.id,
          employeeId: emp.id,
          periodMonth,
          totalDaysInMonth: totalDays,
          paidDays: paidDays.toFixed(2),
          lopDays: lopDays.toFixed(2),
          basic: fromPaise(basicPaise),
          grossEarnings: fromPaise(earningsPaise),
          totalDeductions: fromPaise(deductionsPaise),
          netPay: fromPaise(netPaise),
          employerContributions: fromPaise(employerPaise),
          ctcMonthly: fromPaise(ctcPaise),
          tdsAmount: st.statutory.tdsThisMonth,
          status: PayslipStatus.GENERATED,
        },
        lines,
        statutory: {
          employeeId: emp.id,
          periodMonth,
          ...st.statutory,
        },
      });
    }

    let totalGross = 0n;
    let totalDeductions = 0n;
    let totalNet = 0n;

    await this.dataSource.transaction(async (manager) => {
      // Wipe any prior payslips for this run.
      const priorIds = (
        await manager.getRepository(Payslip).find({
          where: { payRunId: run.id },
          select: ['id'],
        })
      ).map((p) => p.id);
      if (priorIds.length > 0) {
        await manager
          .getRepository(PayslipLine)
          .createQueryBuilder()
          .delete()
          .where('payslipId IN (:...ids)', { ids: priorIds })
          .execute();
        await manager
          .getRepository(PayslipStatutory)
          .createQueryBuilder()
          .delete()
          .where('payslipId IN (:...ids)', { ids: priorIds })
          .execute();
        await manager
          .getRepository(Payslip)
          .delete({ payRunId: run.id });
      }

      for (let i = 0; i < drafts.length; i += 200) {
        const chunk = drafts.slice(i, i + 200);
        const saved = await manager
          .getRepository(Payslip)
          .save(chunk.map((d) => d.payslip));
        const lineRows: Partial<PayslipLine>[] = [];
        const statRows: Partial<PayslipStatutory>[] = [];
        saved.forEach((slip, idx) => {
          totalGross += toPaise(slip.grossEarnings);
          totalDeductions += toPaise(slip.totalDeductions);
          totalNet += toPaise(slip.netPay);
          for (const l of chunk[idx].lines) {
            lineRows.push({ ...l, payslipId: slip.id });
          }
          statRows.push({ ...chunk[idx].statutory, payslipId: slip.id });
        });
        if (lineRows.length > 0) {
          await manager.getRepository(PayslipLine).insert(lineRows);
        }
        if (statRows.length > 0) {
          await manager.getRepository(PayslipStatutory).insert(statRows);
        }
      }

      run.status = PayRunStatus.PROCESSED;
      run.runDate = new Date().toISOString().slice(0, 10);
      run.processedByUserId = actor.userId;
      run.employeeCount = drafts.length;
      run.totalGross = fromPaise(totalGross);
      run.totalDeductions = fromPaise(totalDeductions);
      run.totalNet = fromPaise(totalNet);
      await manager.getRepository(PayRun).save(run);
    });

    await this.auditService.record({
      entityName: 'PayRun',
      entityId: run.id,
      action: AuditAction.STATUS_CHANGE,
      user: actor,
      changes: { status: { old: 'DRAFT/PROCESSED', new: 'PROCESSED' } },
      reason: skipped ? `${skipped} employees skipped (no salary structure)` : undefined,
    });
    await this.cache.del('payroll:dashboard');
    return run;
  }

  async approveRun(id: string, actor: AuthenticatedUser): Promise<PayRun> {
    const run = await this.getRun(id);
    this.assertTransition(run.status, PayRunStatus.APPROVED);
    run.status = PayRunStatus.APPROVED;
    run.approvedByUserId = actor.userId;
    const saved = await this.runRepo.save(run);
    await this.auditService.record({
      entityName: 'PayRun',
      entityId: id,
      action: AuditAction.STATUS_CHANGE,
      user: actor,
      changes: { status: { old: 'PROCESSED', new: 'APPROVED' } },
    });
    await this.cache.del('payroll:dashboard');
    return saved;
  }

  async markPaid(id: string, actor: AuthenticatedUser): Promise<PayRun> {
    const run = await this.getRun(id);
    this.assertTransition(run.status, PayRunStatus.PAID);
    await this.dataSource.transaction(async (manager) => {
      run.status = PayRunStatus.PAID;
      await manager.getRepository(PayRun).save(run);
      await manager
        .getRepository(Payslip)
        .update({ payRunId: id }, { status: PayslipStatus.PAID });
    });
    await this.auditService.record({
      entityName: 'PayRun',
      entityId: id,
      action: AuditAction.STATUS_CHANGE,
      user: actor,
      changes: { status: { old: 'APPROVED', new: 'PAID' } },
    });
    await this.cache.del('payroll:dashboard');
    return run;
  }

  async cancelRun(id: string, actor: AuthenticatedUser): Promise<PayRun> {
    const run = await this.getRun(id);
    this.assertTransition(run.status, PayRunStatus.CANCELLED);
    await this.dataSource.transaction(async (manager) => {
      const ids = (
        await manager
          .getRepository(Payslip)
          .find({ where: { payRunId: id }, select: ['id'] })
      ).map((p) => p.id);
      if (ids.length > 0) {
        await manager
          .getRepository(PayslipLine)
          .createQueryBuilder()
          .delete()
          .where('payslipId IN (:...ids)', { ids })
          .execute();
        await manager
          .getRepository(PayslipStatutory)
          .createQueryBuilder()
          .delete()
          .where('payslipId IN (:...ids)', { ids })
          .execute();
        await manager.getRepository(Payslip).delete({ payRunId: id });
      }
      run.status = PayRunStatus.CANCELLED;
      run.totalGross = '0';
      run.totalDeductions = '0';
      run.totalNet = '0';
      run.employeeCount = 0;
      await manager.getRepository(PayRun).save(run);
    });
    await this.auditService.record({
      entityName: 'PayRun',
      entityId: id,
      action: AuditAction.STATUS_CHANGE,
      user: actor,
      changes: { status: { old: run.status, new: 'CANCELLED' } },
    });
    await this.cache.del('payroll:dashboard');
    return run;
  }

  // ---- payslips ---------------------------------------------

  async listPayslips(
    runId: string,
    query: PaginationQuery,
  ): Promise<Paginated<Payslip>> {
    const limit = query.limit ?? 50;
    const qb = this.payslipRepo
      .createQueryBuilder('p')
      .where('p.payRunId = :runId', { runId })
      .orderBy('p.id', 'ASC')
      .take(limit);
    if (query.cursor) qb.andWhere('p.id > :cursor', { cursor: query.cursor });
    else if (query.page && query.page > 1) {
      qb.skip((query.page - 1) * limit);
    }
    const rows = await qb.getMany();
    const total = await this.payslipRepo.count({ where: { payRunId: runId } });

    // Attach employee display names for the page.
    const eids = [...new Set(rows.map((r) => String(r.employeeId)))];
    const emps: Array<{ id: string; name: string; code: string }> = eids.length
      ? await this.dataSource.query(
          `SELECT id, CONCAT(firstName,' ',lastName) AS name, code
           FROM employees WHERE id IN (${eids.map(() => '?').join(',')})`,
          eids,
        )
      : [];
    const eMap = new Map(emps.map((e) => [String(e.id), e]));
    const enriched = rows.map((r) => ({
      ...r,
      employeeName: eMap.get(String(r.employeeId))?.name ?? null,
      employeeCode: eMap.get(String(r.employeeId))?.code ?? null,
    }));

    return {
      rows: enriched as unknown as Payslip[],
      nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
      total,
      limit,
    };
  }

  async getPayslip(id: string) {
    const payslip = await this.payslipRepo.findOne({ where: { id } });
    if (!payslip) throw new NotFoundException(`Payslip ${id} not found`);
    const lines = await this.payslipLineRepo.find({
      where: { payslipId: id },
      order: { type: 'ASC', id: 'ASC' },
    });
    let employee: unknown = null;
    try {
      employee = await this.employeesService.findById(payslip.employeeId);
    } catch {
      employee = null;
    }
    const statutory = await this.payslipStatutoryRepo.findOne({
      where: { payslipId: id },
    });
    return { ...payslip, lines, statutory, employee };
  }

  employeePayslips(employeeId: string): Promise<Payslip[]> {
    return this.payslipRepo.find({
      where: { employeeId },
      order: { periodMonth: 'DESC' },
      take: 36,
    });
  }

  // ---- dashboard ------------------------------------------

  async dashboard() {
    const cached = await this.cache.get('payroll:dashboard');
    if (cached) return cached;

    const thisMonth = new Date().toISOString().slice(0, 7);
    const [run, headcount, costByDept] = await Promise.all([
      this.runRepo.findOne({ where: { periodMonth: thisMonth } }),
      this.employeesService.findActive().then((e) => e.length),
      this.dataSource.query(
        `SELECT COALESCE(d.name, 'Unassigned') AS department,
                COUNT(*) AS employees,
                COALESCE(SUM(p.netPay), 0) AS net
         FROM payslips p
         JOIN (
           SELECT id FROM pay_runs
           WHERE status IN ('PROCESSED','APPROVED','PAID')
           ORDER BY periodMonth DESC LIMIT 1
         ) r ON r.id = p.payRunId
         JOIN employees e ON e.id = p.employeeId
         LEFT JOIN departments d ON d.id = e.departmentId
         GROUP BY COALESCE(d.name, 'Unassigned')
         ORDER BY net DESC`,
      ),
    ]);

    const result = {
      periodMonth: thisMonth,
      currentRun: run
        ? {
            id: run.id,
            status: run.status,
            totalNet: run.totalNet,
            employeeCount: run.employeeCount,
          }
        : null,
      headcount,
      costByDepartment: (costByDept as Array<Record<string, string>>).map((r) => ({
        department: r.department,
        employees: Number(r.employees),
        net: r.net,
      })),
    };
    await this.cache.set('payroll:dashboard', result, 60_000);
    return result;
  }
}
