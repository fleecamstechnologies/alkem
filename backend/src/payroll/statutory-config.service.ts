import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { StatutoryConfig } from './entities/statutory-config.entity';
import { PtSlab } from './entities/pt-slab.entity';
import { IncomeTaxSlab } from './entities/income-tax-slab.entity';
import { TaxRegime } from '../common/enums/payroll.enum';
import {
  CreatePtSlabDto,
  ReplaceItSlabsDto,
  UpdatePtSlabDto,
  UpdateStatutoryConfigDto,
} from './dto/statutory.dto';
import { toPaise } from '../common/utils/money.util';

const CONFIG_CACHE_KEY = 'statutory:activeConfig';

@Injectable()
export class StatutoryConfigService {
  constructor(
    @InjectRepository(StatutoryConfig)
    private readonly configRepo: Repository<StatutoryConfig>,
    @InjectRepository(PtSlab)
    private readonly ptRepo: Repository<PtSlab>,
    @InjectRepository(IncomeTaxSlab)
    private readonly itRepo: Repository<IncomeTaxSlab>,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /** Apr–Mar financial year label for a "YYYY-MM" period, e.g. "2025-2026". */
  static financialYearOf(periodMonth: string): string {
    const [y, m] = periodMonth.split('-').map(Number);
    const startYear = m >= 4 ? y : y - 1;
    return `${startYear}-${startYear + 1}`;
  }

  /** Months from `periodMonth` to the end of its financial year, inclusive. */
  static monthsRemainingInFy(periodMonth: string): number {
    const [, m] = periodMonth.split('-').map(Number);
    return m >= 4 ? 12 - m + 4 : 4 - m;
  }

  /** In-memory PT resolution against a pre-loaded slab list (no DB). */
  static resolvePt(
    slabs: PtSlab[],
    stateCode: string,
    grossMonthly: string,
    month: number,
  ): { amount: string; stateCode: string } {
    const code = stateCode.toUpperCase();
    const grossP = toPaise(grossMonthly);
    const rows = slabs
      .filter((s) => s.active && s.stateCode.toUpperCase() === code)
      .sort((a, b) => toPaise(a.minGross) - toPaise(b.minGross) > 0n ? 1 : -1);
    for (const s of rows) {
      const minP = toPaise(s.minGross);
      const maxP = s.maxGross == null ? null : toPaise(s.maxGross);
      if (grossP >= minP && (maxP === null || grossP <= maxP)) {
        const amount =
          month === 2 && s.februaryAmount != null
            ? s.februaryAmount
            : s.monthlyAmount;
        return { amount, stateCode: code };
      }
    }
    return { amount: '0.00', stateCode: code };
  }

  async getActiveConfig(): Promise<StatutoryConfig> {
    const cached = await this.cache.get<StatutoryConfig>(CONFIG_CACHE_KEY);
    if (cached) return cached;
    const row = await this.configRepo.findOne({
      where: { active: true },
      order: { effectiveFrom: 'DESC' },
    });
    if (!row) {
      throw new NotFoundException(
        'No active statutory config — run the seed or create one',
      );
    }
    await this.cache.set(CONFIG_CACHE_KEY, row, 60_000);
    return row;
  }

  async updateActiveConfig(
    dto: UpdateStatutoryConfigDto,
    actorUserId: string,
  ): Promise<StatutoryConfig> {
    const row = await this.getActiveConfig();
    Object.assign(row, dto);
    row.createdByUserId = actorUserId;
    const saved = await this.configRepo.save(row);
    await this.cache.del(CONFIG_CACHE_KEY);
    return saved;
  }

  // ---- PT slabs ----------------------------------------------

  listPtSlabs(): Promise<PtSlab[]> {
    return this.ptRepo.find({
      order: { stateCode: 'ASC', minGross: 'ASC' },
    });
  }

  createPtSlab(dto: CreatePtSlabDto): Promise<PtSlab> {
    return this.ptRepo.save(
      this.ptRepo.create({
        stateCode: dto.stateCode.toUpperCase(),
        stateName: dto.stateName,
        effectiveFrom: dto.effectiveFrom,
        minGross: dto.minGross,
        maxGross: dto.maxGross ?? null,
        monthlyAmount: dto.monthlyAmount,
        februaryAmount: dto.februaryAmount ?? null,
        active: dto.active ?? true,
      }),
    );
  }

  async updatePtSlab(id: string, dto: UpdatePtSlabDto): Promise<PtSlab> {
    const row = await this.ptRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`PT slab ${id} not found`);
    Object.assign(row, {
      stateName: dto.stateName ?? row.stateName,
      effectiveFrom: dto.effectiveFrom ?? row.effectiveFrom,
      minGross: dto.minGross ?? row.minGross,
      maxGross: dto.maxGross === undefined ? row.maxGross : dto.maxGross,
      monthlyAmount: dto.monthlyAmount ?? row.monthlyAmount,
      februaryAmount:
        dto.februaryAmount === undefined
          ? row.februaryAmount
          : dto.februaryAmount,
      active: dto.active ?? row.active,
    });
    return this.ptRepo.save(row);
  }

  async deletePtSlab(id: string): Promise<void> {
    const row = await this.ptRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`PT slab ${id} not found`);
    await this.ptRepo.delete(id);
  }

  /** Monthly PT amount for a state + gross. `month` is 1..12 (Feb → 2). */
  async resolvePtAmount(
    stateCode: string,
    grossMonthly: string,
    month: number,
  ): Promise<{ amount: string; stateCode: string }> {
    const slabs = await this.ptRepo.find({
      where: { stateCode: stateCode.toUpperCase(), active: true },
      order: { minGross: 'ASC' },
    });
    return StatutoryConfigService.resolvePt(
      slabs,
      stateCode,
      grossMonthly,
      month,
    );
  }

  // ---- income-tax slabs ------------------------------------

  listItSlabs(financialYear?: string, regime?: TaxRegime): Promise<IncomeTaxSlab[]> {
    const where: Record<string, unknown> = {};
    if (financialYear) where.financialYear = financialYear;
    if (regime) where.regime = regime;
    return this.itRepo.find({
      where,
      order: { regime: 'ASC', minAnnual: 'ASC' },
    });
  }

  slabsFor(financialYear: string, regime: TaxRegime): Promise<IncomeTaxSlab[]> {
    return this.itRepo.find({
      where: { financialYear, regime },
      order: { minAnnual: 'ASC' },
    });
  }

  /** Replace every slab for one (regime, FY) in a transaction. */
  async replaceItSlabs(dto: ReplaceItSlabsDto): Promise<IncomeTaxSlab[]> {
    if (!dto.rows.length) {
      throw new BadRequestException('at least one slab row is required');
    }
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(IncomeTaxSlab);
      await repo.delete({
        regime: dto.regime,
        financialYear: dto.financialYear,
      });
      const rows = dto.rows.map((r) =>
        repo.create({
          regime: dto.regime,
          financialYear: dto.financialYear,
          effectiveFrom: dto.effectiveFrom,
          minAnnual: r.minAnnual,
          maxAnnual: r.maxAnnual ?? null,
          ratePercent: r.ratePercent,
        }),
      );
      return repo.save(rows);
    });
  }
}
