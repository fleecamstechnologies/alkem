export enum ComponentType {
  EARNING = 'EARNING',
  DEDUCTION = 'DEDUCTION',
  /** Employer-side statutory cost (EPF/EPS/EDLI/admin/ESI-ER). Does not affect
   * net pay; shown in its own payslip section and rolled into monthly CTC. */
  EMPLOYER_CONTRIBUTION = 'EMPLOYER_CONTRIBUTION',
}

export enum CalculationType {
  FIXED = 'FIXED',
  PERCENT_OF_BASIC = 'PERCENT_OF_BASIC',
}

export enum PayRunStatus {
  DRAFT = 'DRAFT',
  PROCESSED = 'PROCESSED',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export enum PayslipStatus {
  GENERATED = 'GENERATED',
  PAID = 'PAID',
}

export enum TaxRegime {
  OLD = 'OLD',
  NEW = 'NEW',
}

export enum DeclarationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  LOCKED = 'LOCKED',
}

/** Employee-side statutory deduction component codes owned by the engine. */
export const STATUTORY_DEDUCTION_CODES = ['EPF', 'ESI', 'PT', 'TDS'] as const;

/** Employer-side statutory contribution component codes owned by the engine. */
export const STATUTORY_EMPLOYER_CODES = [
  'EPF_ER',
  'EPS_ER',
  'EDLI_ER',
  'EPF_ADMIN',
  'ESI_ER',
] as const;

/** Legacy manual component codes superseded by the engine (pre-Phase-8 seeds
 * used `PF` for what is now the engine-owned `EPF`). */
export const LEGACY_STATUTORY_CODES = ['PF'] as const;

/** Any payslip/structure line with one of these codes is produced by the
 * statutory engine, never carried over from a manual salary-structure line. */
export const STATUTORY_CODES: ReadonlySet<string> = new Set<string>([
  ...STATUTORY_DEDUCTION_CODES,
  ...STATUTORY_EMPLOYER_CODES,
  ...LEGACY_STATUTORY_CODES,
]);
