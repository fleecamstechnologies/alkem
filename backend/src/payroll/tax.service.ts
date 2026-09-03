import { Injectable } from '@nestjs/common';
import { StatutoryConfig } from './entities/statutory-config.entity';
import { IncomeTaxSlab } from './entities/income-tax-slab.entity';
import { TaxDeclaration } from './entities/tax-declaration.entity';
import { TaxRegime } from '../common/enums/payroll.enum';
import { fromPaise, percentOfPaise, toPaise } from '../common/utils/money.util';

export interface AnnualTaxInput {
  regime: TaxRegime;
  /** Projected annual gross salary (paise). */
  annualGross: bigint;
  /** Projected annual basic (paise) — drives the old-regime HRA exemption. */
  annualBasic: bigint;
  /** Actual annual HRA component received (paise). */
  annualHra: bigint;
  /** Annual professional tax (paise) — old-regime deduction. */
  ptAnnual: bigint;
  /** Annual employee EPF (paise) — counts toward the 80C ceiling. */
  pfEmployeeAnnual: bigint;
  declaration: TaxDeclaration | null;
  config: StatutoryConfig;
  slabs: IncomeTaxSlab[];
}

export interface AnnualTaxResult {
  regime: TaxRegime;
  grossSalary: string;
  standardDeduction: string;
  hraExemption: string;
  professionalTax: string;
  chapterVIA: string;
  otherExempt: string;
  totalDeductions: string;
  taxableIncome: string;
  slabTax: string;
  rebate87A: string;
  cess: string;
  totalTax: string;
  breakup: Array<{ label: string; amount: string }>;
}

const CEILING_80C = 150_000_00n; // ₹1,50,000 in paise
const CEILING_80CCD1B = 50_000_00n;
const CEILING_HOME_LOAN = 200_000_00n;
const CEILING_87A_OLD = 12_500_00n;

function bmin(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}
function bmax(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

@Injectable()
export class TaxService {
  /** Slab tax on a taxable income (paise) using the supplied bands. */
  private slabTax(taxableP: bigint, slabs: IncomeTaxSlab[]): bigint {
    let tax = 0n;
    for (const s of slabs) {
      const minP = toPaise(s.minAnnual);
      if (taxableP <= minP) continue;
      const maxP = s.maxAnnual == null ? taxableP : toPaise(s.maxAnnual);
      const bandP = bmin(taxableP, maxP) - minP;
      if (bandP > 0n) tax += percentOfPaise(bandP, s.ratePercent);
    }
    return tax;
  }

  computeAnnualTax(input: AnnualTaxInput): AnnualTaxResult {
    const { regime, config, declaration } = input;
    const isOld = regime === TaxRegime.OLD;
    const d = declaration;

    const stdDeductionP = toPaise(
      isOld ? config.stdDeductionOld : config.stdDeductionNew,
    );

    // HRA exemption — old regime only, needs rent paid on the declaration.
    let hraExemptP = 0n;
    if (isOld && d && toPaise(d.hraRentPaid) > 0n) {
      const rentP = toPaise(d.hraRentPaid);
      const tenPctBasic = percentOfPaise(input.annualBasic, '10');
      const pctBasic = percentOfPaise(
        input.annualBasic,
        d.metroCity ? '50' : '40',
      );
      hraExemptP = bmax(
        0n,
        bmin(bmin(input.annualHra, rentP - tenPctBasic), pctBasic),
      );
    }

    const ptAnnualP = isOld ? input.ptAnnual : 0n;

    // Chapter VI-A — old regime only.
    let chapterViaP = 0n;
    if (isOld && d) {
      const c80 = bmin(
        CEILING_80C,
        toPaise(d.deduction80C) + input.pfEmployeeAnnual,
      );
      const c80d = toPaise(d.deduction80D);
      const c80ccd1b = bmin(CEILING_80CCD1B, toPaise(d.deduction80CCD1B));
      const homeLoan = bmin(CEILING_HOME_LOAN, toPaise(d.homeLoanInterest));
      const other = toPaise(d.otherChapterVIA);
      chapterViaP = c80 + c80d + c80ccd1b + homeLoan + other;
    }

    const otherExemptP =
      isOld && d ? toPaise(d.otherExemptAllowances) : 0n;

    const totalDeductionsP =
      stdDeductionP + hraExemptP + ptAnnualP + chapterViaP + otherExemptP;

    const taxableP = bmax(0n, input.annualGross - totalDeductionsP);
    const slabTaxP = this.slabTax(taxableP, input.slabs);

    // 87A rebate.
    let rebateP = 0n;
    const rebateLimitP = toPaise(
      isOld ? config.rebate87aOldLimit : config.rebate87aNewLimit,
    );
    if (taxableP <= rebateLimitP) {
      rebateP = isOld ? bmin(slabTaxP, CEILING_87A_OLD) : slabTaxP;
    }

    const taxAfterRebateP = bmax(0n, slabTaxP - rebateP);
    const cessP = percentOfPaise(taxAfterRebateP, config.cessRate);
    const totalTaxP = taxAfterRebateP + cessP;

    return {
      regime,
      grossSalary: fromPaise(input.annualGross),
      standardDeduction: fromPaise(stdDeductionP),
      hraExemption: fromPaise(hraExemptP),
      professionalTax: fromPaise(ptAnnualP),
      chapterVIA: fromPaise(chapterViaP),
      otherExempt: fromPaise(otherExemptP),
      totalDeductions: fromPaise(totalDeductionsP),
      taxableIncome: fromPaise(taxableP),
      slabTax: fromPaise(slabTaxP),
      rebate87A: fromPaise(rebateP),
      cess: fromPaise(cessP),
      totalTax: fromPaise(totalTaxP),
      breakup: [
        { label: 'Projected gross salary', amount: fromPaise(input.annualGross) },
        { label: 'Standard deduction', amount: `-${fromPaise(stdDeductionP)}` },
        { label: 'HRA exemption', amount: `-${fromPaise(hraExemptP)}` },
        { label: 'Professional tax', amount: `-${fromPaise(ptAnnualP)}` },
        { label: 'Chapter VI-A deductions', amount: `-${fromPaise(chapterViaP)}` },
        { label: 'Other exemptions', amount: `-${fromPaise(otherExemptP)}` },
        { label: 'Taxable income', amount: fromPaise(taxableP) },
        { label: 'Tax on slabs', amount: fromPaise(slabTaxP) },
        { label: 'Rebate u/s 87A', amount: `-${fromPaise(rebateP)}` },
        { label: `Health & education cess`, amount: fromPaise(cessP) },
        { label: 'Total tax liability', amount: fromPaise(totalTaxP) },
      ],
    };
  }
}
