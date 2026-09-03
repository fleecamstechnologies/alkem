import type { ReportResult } from './types';

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** RFC-4180 CSV with a UTF-8 BOM so Excel opens it in the right encoding. */
export function toCsv(result: ReportResult): string {
  const header = result.columns.map((c) => cell(c.label)).join(',');
  const lines = result.rows.map((row) =>
    result.columns.map((c) => cell(row[c.key])).join(','),
  );
  return '﻿' + [header, ...lines].join('\r\n') + '\r\n';
}
