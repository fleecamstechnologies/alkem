import { Injectable } from '@nestjs/common';
import { StatutoryConfig } from './entities/statutory-config.entity';
import { PtSlab } from './entities/pt-slab.entity';
import { IncomeTaxSlab } from './entities/income-tax-slab.entity';
import { EmployeeStatutoryProfile } from './entities/employee-statutory-profile.entity';
import { TaxDeclaration } from './entities/tax-declaration.entity';
import { ComponentType, TaxRegime } from '../common/enums/payroll.enum';
import { StatutoryConfigService } from './statutory-config.service';
import { TaxService } from './tax.service';
import {
  ceilToRupeePaise,
  fromPaise,
  percentOfPaise,
  roundToRupeePaise,
  toPaise,
} from '../common/utils/money.util';

export interface StatutoryLine {
  componentCode: string;
  componentName: string;
  type: ComponentType;
  amount: string;
}

export interface StatutoryYtd {
  grossPaid: string;
  tdsPaid: string;
  ptPaid: string;
  pfEmployeePaid: string;
}

export interface ComputeStatutoryInput {
  profile: EmployeeStatutoryProfile;
  config: StatutoryConfig;
  declaration: TaxDeclaration | null;
  slabs: IncomeTaxSlab[];
  ptSlabs: PtSlab[];
  basicMonthly: string;
  hraMonthly: string;
  grossEarningsMonthly: string;
  totalDaysInMonth: number;
  paidDays: number;
  lopDays: number;
  periodMonth: string;
  ytd: StatutoryYtd;
}

export interface ComputeStatutoryResult {
  deductionLines: StatutoryLine[];
  employerLines: StatutoryLine[];
  statutory: {
    financialYear: string;
    pfWages: string;
    epfEmployee: string;
    epsEmployer: string;
    epfEmployer: string;
    edliEmployer: string;
    pfAdminEmployer: string;
    ncpDays: string;
    esiApplicable: boolean;
    esiWages: string;
    esiEmployee: string;
    esiEmployer: string;
    ptStateCode: string;
    ptAmount: string;
    taxRegime: TaxRegime;
    projectedAnnualGross: string;
    projectedTaxableIncome: string;
    projectedAnnualTax: string;
    tdsThisMonth: string;
    tdsYtd: string;
  };
}

const D = ComponentType.DEDUCTION;
const ER = ComponentType.EMPLOYER_CONTRIBUTION;

@Injectable()
export class StatutoryService {
  constructor(private readonly taxService: TaxService) {}

  computeForPayslip(input: ComputeStatutoryInput): ComputeStatutoryResult {
    const { profile, config } = input;
    const dayRatio = (n: bigint): bigint =>
      input.totalDaysInMonth > 0
        ? (n * BigInt(Math.round(input.paidDays * 100))) /
          BigInt(input.totalDaysInMonth * 100)
        : n;

    // ---- Provident Fund --------------------------------------
    const basicP = toPaise(input.basicMonthly);
    const ceilingP = toPaise(config.pfWageCeiling);
    const epsCeilingP = toPaise(config.epsWageCeiling);

    let pfWageP = 0n;
    let epfEmployeeP = 0n;
    let epsEmployerP = 0n;
    let epfEmployerP = 0n;
    let edliEmployerP = 0n;
    let pfAdminEmployerP = 0n;

    if (profile.pfApplicable) {
      const fullPfWageP =
        profile.pfUsesActualWage || !config.pfCapAtCeilingDefault
          ? basicP
          : basicP < ceilingP
            ? basicP
            : ceilingP;
      pfWageP = dayRatio(fullPfWageP);
      const epsBaseP = dayRatio(
        fullPfWageP < epsCeilingP ? fullPfWageP : epsCeilingP,
      );

      epfEmployeeP = percentOfPaise(pfWageP, config.pfEmployeeRate);
      const employerShareP = percentOfPaise(pfWageP, config.pfEmployerRate);
      epsEmployerP = roundToRupeePaise(
        percentOfPaise(epsBaseP, config.epsRate),
      );
      epfEmployerP =
        employerShareP - epsEmployerP > 0n ? employerShareP - epsEmployerP : 0n;
      edliEmployerP = percentOfPaise(epsBaseP, config.edliRate);
      pfAdminEmployerP = percentOfPaise(pfWageP, config.pfAdminRate);
    }

    // ---- ESI -----------------------------------------------
    const grossP = toPaise(input.grossEarningsMonthly);
    const esiCeilingP = toPaise(config.esiWageCeiling);
    const esiApplicable =
      profile.esiApplicable ?? grossP <= esiCeilingP;
    let esiEmployeeP = 0n;
    let esiEmployerP = 0n;
    if (esiApplicable && grossP > 0n) {
      esiEmployeeP = ceilToRupeePaise(
        percentOfPaise(grossP, config.esiEmployeeRate),
      );
      esiEmployerP = ceilToRupeePaise(
        percentOfPaise(grossP, config.esiEmployerRate),
      );
    }

    // ---- Professional tax --------------------------------
    const month = Number(input.periodMonth.split('-')[1]);
    const pt = StatutoryConfigService.resolvePt(
      input.ptSlabs,
      profile.ptStateCode,
      input.grossEarningsMonthly,
      month,
    );
    const ptP = toPaise(pt.amount);

    // ---- TDS (projection) -------------------------------
    const fy = StatutoryConfigService.financialYearOf(input.periodMonth);
    const monthsRemaining =
      StatutoryConfigService.monthsRemainingInFy(input.periodMonth);
    const regime = input.declaration?.regime ?? TaxRegime.NEW;

    const projAnnualGrossP =
      toPaise(input.ytd.grossPaid) + grossP * BigInt(monthsRemaining);
    const ptAnnualP = toPaise(input.ytd.ptPaid) + ptP * BigInt(monthsRemaining);
    const pfEmployeeAnnualP =
      toPaise(input.ytd.pfEmployeePaid) +
      epfEmployeeP * BigInt(monthsRemaining);

    const tax = this.taxService.computeAnnualTax({
      regime,
      annualGross: projAnnualGrossP,
      annualBasic: basicP * 12n,
      annualHra: toPaise(input.hraMonthly) * 12n,
      ptAnnual: ptAnnualP,
      pfEmployeeAnnual: pfEmployeeAnnualP,
      declaration: input.declaration,
      config,
      slabs: input.slabs,
    });

    const tdsYtdP = toPaise(input.ytd.tdsPaid);
    const remainingTaxP = toPaise(tax.totalTax) - tdsYtdP;
    const tdsThisMonthP =
      remainingTaxP > 0n && monthsRemaining > 0
        ? roundToRupeePaise(remainingTaxP / BigInt(monthsRemaining))
        : 0n;

    // ---- assemble lines ------------------------------
    const deductionLines: StatutoryLine[] = [];
    const employerLines: StatutoryLine[] = [];

    if (epfEmployeeP > 0n) {
      deductionLines.push(line('EPF', 'Provident Fund', D, epfEmployeeP));
    }
    if (esiEmployeeP > 0n) {
      deductionLines.push(
        line('ESI', 'Employee State Insurance', D, esiEmployeeP),
      );
    }
    if (ptP > 0n) {
      deductionLines.push(line('PT', 'Professional Tax', D, ptP));
    }
    if (tdsThisMonthP > 0n) {
      deductionLines.push(line('TDS', 'Income Tax (TDS)', D, tdsThisMonthP));
    }

    if (epfEmployerP > 0n) {
      employerLines.push(line('EPF_ER', 'Employer PF', ER, epfEmployerP));
    }
    if (epsEmployerP > 0n) {
      employerLines.push(
        line('EPS_ER', 'Employer Pension (EPS)', ER, epsEmployerP),
      );
    }
    if (edliEmployerP > 0n) {
      employerLines.push(line('EDLI_ER', 'EDLI', ER, edliEmployerP));
    }
    if (pfAdminEmployerP > 0n) {
      employerLines.push(
        line('EPF_ADMIN', 'PF Admin Charges', ER, pfAdminEmployerP),
      );
    }
    if (esiEmployerP > 0n) {
      employerLines.push(line('ESI_ER', 'Employer ESI', ER, esiEmployerP));
    }

    return {
      deductionLines,
      employerLines,
      statutory: {
        financialYear: fy,
        pfWages: fromPaise(pfWageP),
        epfEmployee: fromPaise(epfEmployeeP),
        epsEmployer: fromPaise(epsEmployerP),
        epfEmployer: fromPaise(epfEmployerP),
        edliEmployer: fromPaise(edliEmployerP),
        pfAdminEmployer: fromPaise(pfAdminEmployerP),
        ncpDays: input.lopDays.toFixed(2),
        esiApplicable,
        esiWages: fromPaise(esiApplicable ? grossP : 0n),
        esiEmployee: fromPaise(esiEmployeeP),
        esiEmployer: fromPaise(esiEmployerP),
        ptStateCode: pt.stateCode,
        ptAmount: fromPaise(ptP),
        taxRegime: regime,
        projectedAnnualGross: fromPaise(projAnnualGrossP),
        projectedTaxableIncome: tax.taxableIncome,
        projectedAnnualTax: tax.totalTax,
        tdsThisMonth: fromPaise(tdsThisMonthP),
        tdsYtd: fromPaise(tdsYtdP),
      },
    };
  }
}

function line(
  code: string,
  name: string,
  type: ComponentType,
  amountP: bigint,
): StatutoryLine {
  return { componentCode: code, componentName: name, type, amount: fromPaise(amountP) };
}
