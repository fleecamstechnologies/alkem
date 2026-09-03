import type { DataSource } from 'typeorm';
import type { UserRole } from '../common/enums/user-role.enum';

export type ParamType =
  | 'date'
  | 'month'
  | 'text'
  | 'number'
  | 'select'
  | 'payRun';

export interface ParamDef {
  key: string;
  label: string;
  type: ParamType;
  required?: boolean;
  default?: string;
  options?: { value: string; label: string }[];
}

export interface ReportColumn {
  key: string;
  label: string;
  type?: 'money' | 'number' | 'date' | 'text';
}

export interface ReportResult {
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  meta?: Record<string, unknown>;
}

export type ReportCategory =
  | 'Payroll'
  | 'HR'
  | 'Finance'
  | 'CRM'
  | 'Field'
  | 'Clinical'
  | 'Pharmacy';

export interface ReportContext {
  ds: DataSource;
  role: UserRole;
  /** Max data rows the caller wants (preview cap vs export cap). */
  limit: number;
  /** Extra services a definition may need (kept small on purpose). */
  services: {
    statement: (
      customerId: string,
      from: string,
      to: string,
    ) => Promise<{
      openingBalance: string;
      closingBalance: string;
      currentBalance: string;
      lines: Array<Record<string, unknown>>;
    }>;
  };
}

export interface ReportDef {
  key: string;
  name: string;
  category: ReportCategory;
  description?: string;
  roles: UserRole[];
  params: ParamDef[];
  run(params: Record<string, string>, ctx: ReportContext): Promise<ReportResult>;
}

/** Shape returned by GET /reports (no `run`). */
export interface ReportInfo {
  key: string;
  name: string;
  category: ReportCategory;
  description?: string;
  params: ParamDef[];
}
