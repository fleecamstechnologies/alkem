import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { REPORT_DEFS } from './report-definitions';
import { toCsv } from './csv.util';
import type {
  ReportContext,
  ReportInfo,
  ReportResult,
} from './types';
import { PaymentsService } from '../payments/payments.service';
import type { UserRole } from '../common/enums/user-role.enum';

export type ReportFormat = 'json' | 'csv' | 'xlsx';

const PREVIEW_CAP = 500;
const EXPORT_CAP = 100_000;

@Injectable()
export class ReportsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly paymentsService: PaymentsService,
  ) {}

  list(role: UserRole): ReportInfo[] {
    return REPORT_DEFS.filter((d) => d.roles.includes(role)).map((d) => ({
      key: d.key,
      name: d.name,
      category: d.category,
      description: d.description,
      params: d.params,
    }));
  }

  async run(
    key: string,
    params: Record<string, string>,
    role: UserRole,
    format: ReportFormat,
  ): Promise<ReportResult> {
    const def = REPORT_DEFS.find((d) => d.key === key);
    if (!def) throw new NotFoundException(`Unknown report "${key}"`);
    if (!def.roles.includes(role)) {
      throw new ForbiddenException(`Your role cannot run "${key}"`);
    }

    const cap = format === 'json' ? PREVIEW_CAP : EXPORT_CAP;
    const ctx: ReportContext = {
      ds: this.ds,
      role,
      limit: cap,
      services: {
        statement: (customerId, from, to) =>
          this.paymentsService.statement(customerId, from, to) as Promise<{
            openingBalance: string;
            closingBalance: string;
            currentBalance: string;
            lines: Array<Record<string, unknown>>;
          }>,
      },
    };

    const result = await def.run(params, ctx);

    if (result.rows.length >= cap) {
      if (format === 'json') {
        result.meta = { ...result.meta, truncated: true, previewCap: cap };
      } else {
        throw new BadRequestException(
          `This report returned ${result.rows.length}+ rows — add filters to narrow it below ${cap}.`,
        );
      }
    }
    return result;
  }

  csv(result: ReportResult): string {
    return toCsv(result);
  }

  async xlsx(result: ReportResult, name: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Alkem HRMS';
    wb.created = new Date();
    const ws = wb.addWorksheet(name.slice(0, 28) || 'Report');

    ws.columns = result.columns.map((c) => ({
      header: c.label,
      key: c.key,
      width: Math.min(40, Math.max(12, c.label.length + 2)),
      style:
        c.type === 'money'
          ? { numFmt: '#,##0.00', alignment: { horizontal: 'right' } }
          : c.type === 'number'
            ? { alignment: { horizontal: 'right' } }
            : {},
    }));
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    for (const row of result.rows) {
      const out: Record<string, unknown> = {};
      for (const c of result.columns) {
        const v = row[c.key];
        out[c.key] =
          (c.type === 'money' || c.type === 'number') &&
          v !== null &&
          v !== undefined &&
          v !== '' &&
          !Number.isNaN(Number(v))
            ? Number(v)
            : (v ?? '');
      }
      ws.addRow(out);
    }

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
