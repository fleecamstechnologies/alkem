import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import * as ExcelJS from 'exceljs';

export interface SourceRow {
  rowNumber: number; // 1-based data row number (header excluded)
  record: Record<string, string>;
}

/** Stream rows out of a .csv or .xlsx file as header-keyed string records. */
export async function* readRows(
  filePath: string,
  originalName: string,
): AsyncGenerator<SourceRow> {
  const lower = originalName.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) {
    yield* readXlsx(filePath);
  } else {
    yield* readCsv(filePath);
  }
}

async function* readCsv(filePath: string): AsyncGenerator<SourceRow> {
  const parser = createReadStream(filePath).pipe(
    parse({
      columns: (header: string[]) => header.map((h) => h.trim()),
      trim: true,
      skip_empty_lines: true,
      bom: true,
      relax_column_count: true,
    }),
  );
  let rowNumber = 0;
  for await (const record of parser) {
    rowNumber += 1;
    yield { rowNumber, record: record as Record<string, string> };
  }
}

async function* readXlsx(filePath: string): AsyncGenerator<SourceRow> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    entries: 'emit',
    sharedStrings: 'cache',
    worksheets: 'emit',
  });

  let headers: string[] = [];
  let rowNumber = 0;

  for await (const worksheet of workbook) {
    for await (const row of worksheet) {
      const values = (row.values as unknown[]).slice(1).map((v) => cell(v));
      if (row.number === 1) {
        headers = values.map((v) => v.trim());
        continue;
      }
      if (values.every((v) => v === '')) continue;
      rowNumber += 1;
      const record: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (h) record[h] = values[i] ?? '';
      });
      yield { rowNumber, record };
    }
    break; // first worksheet only
  }
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const obj = value as { text?: string; result?: unknown; hyperlink?: string };
    if (obj.text) return String(obj.text);
    if (obj.result !== undefined) return String(obj.result);
    if (obj.hyperlink) return String(obj.hyperlink);
    return '';
  }
  return String(value).trim();
}
