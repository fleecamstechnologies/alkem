import { BadRequestException } from '@nestjs/common';
import {
  HR_READ_ROLES,
  READ_ROLES,
  UserRole,
} from '../common/enums/user-role.enum';
import { eachDate, isWeekOff, monthDateRange } from '../common/utils/working-days.util';
import type { ReportColumn, ReportContext, ReportDef, ReportResult } from './types';

const FINANCE_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.FINANCE];
const PII_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

function need(params: Record<string, string>, key: string): string {
  const v = (params[key] ?? '').trim();
  if (!v) throw new BadRequestException(`missing required parameter "${key}"`);
  return v;
}
function reqDate(params: Record<string, string>, key: string): string {
  const v = need(params, key);
  if (!DATE_RE.test(v)) {
    throw new BadRequestException(`${key} must be YYYY-MM-DD`);
  }
  return v;
}
function reqMonth(params: Record<string, string>, key: string): string {
  const v = need(params, key);
  if (!MONTH_RE.test(v)) throw new BadRequestException(`${key} must be YYYY-MM`);
  return v;
}
/** Append `AND col = ?` when the param is present; mutates `where`/`args`. */
function opt(
  params: Record<string, string>,
  key: string,
  col: string,
  where: string[],
  args: unknown[],
): void {
  const v = (params[key] ?? '').trim();
  if (v) {
    where.push(`${col} = ?`);
    args.push(v);
  }
}

// ---------------------------------------------------------------------------

const payrollRegister: ReportDef = {
  key: 'payroll-register',
  name: 'Payroll register',
  category: 'Payroll',
  description: 'Every payslip in a pay run with component breakdown.',
  roles: HR_READ_ROLES,
  params: [{ key: 'payRunId', label: 'Pay run', type: 'payRun', required: true }],
  async run(params, ctx): Promise<ReportResult> {
    const payRunId = need(params, 'payRunId');
    const slips: Array<Record<string, string>> = await ctx.ds.query(
      `SELECT ps.id, e.code AS employeeCode,
              CONCAT(e.firstName,' ',e.lastName) AS employeeName,
              d.name AS department, e.designation,
              ps.paidDays, ps.lopDays, ps.basic, ps.grossEarnings,
              ps.totalDeductions, ps.netPay
       FROM payslips ps
       JOIN employees e ON e.id = ps.employeeId
       LEFT JOIN departments d ON d.id = e.departmentId
       WHERE ps.payRunId = ?
       ORDER BY e.code
       LIMIT ?`,
      [payRunId, ctx.limit],
    );
    const ids = slips.map((s) => s.id);
    const lines: Array<Record<string, string>> = ids.length
      ? await ctx.ds.query(
          `SELECT payslipId, componentCode, componentName, type, amount
           FROM payslip_lines WHERE payslipId IN (${ids.map(() => '?').join(',')})`,
          ids,
        )
      : [];

    const compOrder = new Map<string, { name: string; type: string }>();
    const byslip = new Map<string, Record<string, string>>();
    for (const l of lines) {
      if (l.componentCode !== 'BASIC') {
        compOrder.set(l.componentCode, {
          name: l.componentName,
          type: l.type,
        });
      }
      const m = byslip.get(l.payslipId) ?? {};
      m[l.componentCode] = l.amount;
      byslip.set(l.payslipId, m);
    }
    const compCodes = [...compOrder.entries()]
      .sort((a, b) =>
        a[1].type === b[1].type
          ? a[0].localeCompare(b[0])
          : a[1].type === 'EARNING'
            ? -1
            : 1,
      )
      .map(([code]) => code);

    const columns: ReportColumn[] = [
      { key: 'employeeCode', label: 'Emp code' },
      { key: 'employeeName', label: 'Name' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
      { key: 'paidDays', label: 'Paid days', type: 'number' },
      { key: 'lopDays', label: 'LOP days', type: 'number' },
      { key: 'basic', label: 'Basic', type: 'money' },
      ...compCodes.map(
        (c): ReportColumn => ({
          key: c,
          label: compOrder.get(c)!.name,
          type: 'money',
        }),
      ),
      { key: 'grossEarnings', label: 'Gross', type: 'money' },
      { key: 'totalDeductions', label: 'Deductions', type: 'money' },
      { key: 'netPay', label: 'Net pay', type: 'money' },
    ];

    const rows = slips.map((s) => {
      const comps = byslip.get(s.id) ?? {};
      const { id: _id, ...rest } = s;
      void _id;
      const row: Record<string, unknown> = { ...rest };
      for (const c of compCodes) row[c] = comps[c] ?? '0.00';
      return row;
    });

    return { columns, rows, meta: { payRunId, employees: rows.length } };
  },
};

const bankTransfer: ReportDef = {
  key: 'bank-transfer',
  name: 'Bank transfer sheet',
  category: 'Payroll',
  description: 'Net-pay beneficiary list for bank upload.',
  roles: FINANCE_ROLES.concat(UserRole.HR_ADMIN),
  params: [{ key: 'payRunId', label: 'Pay run', type: 'payRun', required: true }],
  async run(params, ctx): Promise<ReportResult> {
    const payRunId = need(params, 'payRunId');
    const rowsRaw: Array<Record<string, string | null>> = await ctx.ds.query(
      `SELECT e.code AS employeeCode,
              CONCAT(e.firstName,' ',e.lastName) AS employeeName,
              e.bankAccountName AS beneficiaryName,
              e.bankAccountNumber AS accountNumber,
              e.bankIfsc AS ifsc, ps.netPay AS amount, ps.periodMonth
       FROM payslips ps JOIN employees e ON e.id = ps.employeeId
       WHERE ps.payRunId = ?
       ORDER BY e.code
       LIMIT ?`,
      [payRunId, ctx.limit],
    );
    const good: Record<string, unknown>[] = [];
    const skipped: string[] = [];
    for (const r of rowsRaw) {
      if (r.accountNumber && r.ifsc) {
        good.push({
          beneficiaryName: r.beneficiaryName || r.employeeName,
          accountNumber: r.accountNumber,
          ifsc: r.ifsc,
          amount: r.amount,
          narration: `Salary ${r.periodMonth}`,
          employeeCode: r.employeeCode,
        });
      } else {
        skipped.push(String(r.employeeCode));
      }
    }
    return {
      columns: [
        { key: 'beneficiaryName', label: 'Beneficiary name' },
        { key: 'accountNumber', label: 'Account number' },
        { key: 'ifsc', label: 'IFSC' },
        { key: 'amount', label: 'Amount', type: 'money' },
        { key: 'narration', label: 'Narration' },
        { key: 'employeeCode', label: 'Emp code' },
      ],
      rows: good,
      meta: { skipped, skippedCount: skipped.length },
    };
  },
};

const componentSummary: ReportDef = {
  key: 'salary-component-summary',
  name: 'Salary component summary',
  category: 'Payroll',
  description: 'Totals per component for a month (PF / PT challan prep).',
  roles: HR_READ_ROLES,
  params: [{ key: 'periodMonth', label: 'Month', type: 'month', required: true }],
  async run(params, ctx): Promise<ReportResult> {
    const periodMonth = reqMonth(params, 'periodMonth');
    const rows: Array<Record<string, string>> = await ctx.ds.query(
      `SELECT pl.componentCode, pl.componentName, pl.type,
              SUM(pl.amount) AS total, COUNT(*) AS employees
       FROM payslip_lines pl
       JOIN payslips p ON p.id = pl.payslipId
       WHERE p.periodMonth = ?
       GROUP BY pl.componentCode, pl.componentName, pl.type
       ORDER BY pl.type, pl.componentCode`,
      [periodMonth],
    );
    return {
      columns: [
        { key: 'componentCode', label: 'Code' },
        { key: 'componentName', label: 'Component' },
        { key: 'type', label: 'Type' },
        { key: 'employees', label: 'Employees', type: 'number' },
        { key: 'total', label: 'Total', type: 'money' },
      ],
      rows,
      meta: { periodMonth },
    };
  },
};

const attendanceRegister: ReportDef = {
  key: 'attendance-register',
  name: 'Attendance register',
  category: 'HR',
  description: 'Employee × day matrix for a month with totals.',
  roles: HR_READ_ROLES,
  params: [
    { key: 'periodMonth', label: 'Month', type: 'month', required: true },
    { key: 'departmentId', label: 'Department id', type: 'number' },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const periodMonth = reqMonth(params, 'periodMonth');
    const { from, to } = monthDateRange(periodMonth);
    const dates = eachDate(from, to);

    const empWhere = ['e.deletedAt IS NULL', "e.status = 'ACTIVE'"];
    const empArgs: unknown[] = [];
    opt(params, 'departmentId', 'e.departmentId', empWhere, empArgs);
    const employees: Array<Record<string, string>> = await ctx.ds.query(
      `SELECT e.id, e.code, CONCAT(e.firstName,' ',e.lastName) AS name,
              d.name AS department
       FROM employees e LEFT JOIN departments d ON d.id = e.departmentId
       WHERE ${empWhere.join(' AND ')}
       ORDER BY e.code
       LIMIT ?`,
      [...empArgs, ctx.limit],
    );
    const empIds = employees.map((e) => e.id);

    const records: Array<{
      employeeId: string;
      date: string;
      status: string;
      paid: number | null;
    }> = empIds.length
      ? await ctx.ds.query(
          `SELECT a.employeeId, DATE_FORMAT(a.date,'%Y-%m-%d') AS date,
                  a.status, lt.paid
           FROM attendance_records a
           LEFT JOIN leave_types lt ON lt.id = a.leaveTypeId
           WHERE a.date BETWEEN ? AND ?
             AND a.employeeId IN (${empIds.map(() => '?').join(',')})`,
          [from, to, ...empIds],
        )
      : [];
    const holidays: Array<{ date: string }> = await ctx.ds.query(
      `SELECT DATE_FORMAT(date,'%Y-%m-%d') AS date FROM holidays
       WHERE date BETWEEN ? AND ?`,
      [from, to],
    );
    const holidaySet = new Set(holidays.map((h) => h.date));
    const recMap = new Map<string, { status: string; paid: number | null }>();
    for (const r of records) {
      recMap.set(`${r.employeeId}_${r.date}`, {
        status: r.status,
        paid: r.paid,
      });
    }

    const dayCols: ReportColumn[] = dates.map((d) => ({
      key: d,
      label: d.slice(8),
    }));
    const columns: ReportColumn[] = [
      { key: 'code', label: 'Emp code' },
      { key: 'name', label: 'Name' },
      { key: 'department', label: 'Department' },
      ...dayCols,
      { key: 'present', label: 'P', type: 'number' },
      { key: 'absent', label: 'A', type: 'number' },
      { key: 'leave', label: 'L', type: 'number' },
      { key: 'lop', label: 'LOP', type: 'number' },
    ];

    const CODE: Record<string, string> = {
      PRESENT: 'P',
      ABSENT: 'A',
      ON_LEAVE: 'L',
      HALF_DAY: '½',
      HOLIDAY: 'H',
      WEEK_OFF: '-',
    };

    const rows = employees.map((e) => {
      const row: Record<string, unknown> = {
        code: e.code,
        name: e.name,
        department: e.department ?? '',
      };
      let present = 0;
      let absent = 0;
      let leave = 0;
      let lop = 0;
      for (const d of dates) {
        const rec = recMap.get(`${e.id}_${d}`);
        let status: string;
        if (rec) status = rec.status;
        else if (holidaySet.has(d)) status = 'HOLIDAY';
        else if (isWeekOff(d)) status = 'WEEK_OFF';
        else status = 'PRESENT';
        row[d] = CODE[status] ?? '?';

        if (status === 'PRESENT') present += 1;
        else if (status === 'ABSENT') {
          absent += 1;
          lop += 1;
        } else if (status === 'ON_LEAVE') {
          leave += 1;
          if (rec && rec.paid === 0) lop += 1;
        } else if (status === 'HALF_DAY') {
          leave += 0.5;
          present += 0.5;
          if (!rec || rec.paid === 0) lop += 0.5;
        }
      }
      row.present = present;
      row.absent = absent;
      row.leave = leave;
      row.lop = lop;
      return row;
    });

    return { columns, rows, meta: { periodMonth, days: dates.length } };
  },
};

const leaveBalance: ReportDef = {
  key: 'leave-balance',
  name: 'Leave balance report',
  category: 'HR',
  roles: HR_READ_ROLES,
  params: [
    { key: 'year', label: 'Year', type: 'number', required: true },
    { key: 'departmentId', label: 'Department id', type: 'number' },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const year = need(params, 'year');
    const where = ['lb.year = ?', 'e.deletedAt IS NULL'];
    const args: unknown[] = [year];
    opt(params, 'departmentId', 'e.departmentId', where, args);
    const rows: Array<Record<string, string>> = await ctx.ds.query(
      `SELECT e.code, CONCAT(e.firstName,' ',e.lastName) AS name,
              d.name AS department, lt.code AS leaveType,
              lb.entitled, lb.used, lb.pending,
              (lb.entitled - lb.used - lb.pending) AS available
       FROM leave_balances lb
       JOIN employees e ON e.id = lb.employeeId
       JOIN leave_types lt ON lt.id = lb.leaveTypeId
       LEFT JOIN departments d ON d.id = e.departmentId
       WHERE ${where.join(' AND ')}
       ORDER BY e.code, lt.code
       LIMIT ?`,
      [...args, ctx.limit],
    );
    return {
      columns: [
        { key: 'code', label: 'Emp code' },
        { key: 'name', label: 'Name' },
        { key: 'department', label: 'Department' },
        { key: 'leaveType', label: 'Type' },
        { key: 'entitled', label: 'Entitled', type: 'number' },
        { key: 'used', label: 'Used', type: 'number' },
        { key: 'pending', label: 'Pending', type: 'number' },
        { key: 'available', label: 'Available', type: 'number' },
      ],
      rows,
      meta: { year },
    };
  },
};

const employeeMaster: ReportDef = {
  key: 'employee-master',
  name: 'Employee master',
  category: 'HR',
  roles: HR_READ_ROLES,
  params: [
    { key: 'departmentId', label: 'Department id', type: 'number' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'].map((v) => ({
        value: v,
        label: v,
      })),
    },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const where = ['e.deletedAt IS NULL'];
    const args: unknown[] = [];
    opt(params, 'departmentId', 'e.departmentId', where, args);
    opt(params, 'status', 'e.status', where, args);
    const rows: Array<Record<string, string | null>> = await ctx.ds.query(
      `SELECT e.code, e.firstName, e.lastName, e.email, e.phone,
              d.name AS department, e.designation, e.employmentType, e.status,
              DATE_FORMAT(e.dateOfJoining,'%Y-%m-%d') AS dateOfJoining,
              DATE_FORMAT(e.dateOfLeaving,'%Y-%m-%d') AS dateOfLeaving,
              e.workLocation,
              e.bankAccountNumber, e.bankName, e.bankIfsc,
              e.pfNumber, e.uanNumber, e.esiNumber,
              e.panNumber, e.aadhaarNumber, e.ctcAnnual
       FROM employees e LEFT JOIN departments d ON d.id = e.departmentId
       WHERE ${where.join(' AND ')}
       ORDER BY e.code
       LIMIT ?`,
      [...args, ctx.limit],
    );
    const showPii = PII_ROLES.includes(ctx.role);
    if (!showPii) {
      for (const r of rows) {
        r.panNumber = null;
        r.aadhaarNumber = null;
      }
    }
    return {
      columns: [
        { key: 'code', label: 'Code' },
        { key: 'firstName', label: 'First name' },
        { key: 'lastName', label: 'Last name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'department', label: 'Department' },
        { key: 'designation', label: 'Designation' },
        { key: 'employmentType', label: 'Type' },
        { key: 'status', label: 'Status' },
        { key: 'dateOfJoining', label: 'Joined', type: 'date' },
        { key: 'dateOfLeaving', label: 'Left', type: 'date' },
        { key: 'workLocation', label: 'Location' },
        { key: 'bankAccountNumber', label: 'A/c number' },
        { key: 'bankName', label: 'Bank' },
        { key: 'bankIfsc', label: 'IFSC' },
        { key: 'pfNumber', label: 'PF no.' },
        { key: 'uanNumber', label: 'UAN' },
        { key: 'esiNumber', label: 'ESI no.' },
        { key: 'panNumber', label: 'PAN' },
        { key: 'aadhaarNumber', label: 'Aadhaar' },
        { key: 'ctcAnnual', label: 'Annual CTC', type: 'money' },
      ],
      rows,
      meta: { piiVisible: showPii },
    };
  },
};

const joinersExits: ReportDef = {
  key: 'joiners-exits',
  name: 'New joiners & exits',
  category: 'HR',
  roles: HR_READ_ROLES,
  params: [
    { key: 'from', label: 'From', type: 'date', required: true },
    { key: 'to', label: 'To', type: 'date', required: true },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const from = reqDate(params, 'from');
    const to = reqDate(params, 'to');
    const rows: Array<Record<string, string>> = await ctx.ds.query(
      `SELECT e.code, CONCAT(e.firstName,' ',e.lastName) AS name,
              d.name AS department, e.designation,
              DATE_FORMAT(e.dateOfJoining,'%Y-%m-%d') AS dateOfJoining,
              DATE_FORMAT(e.dateOfLeaving,'%Y-%m-%d') AS dateOfLeaving,
              CASE WHEN e.dateOfJoining BETWEEN ? AND ? THEN 'JOINED' ELSE 'LEFT' END AS event
       FROM employees e LEFT JOIN departments d ON d.id = e.departmentId
       WHERE (e.dateOfJoining BETWEEN ? AND ?) OR (e.dateOfLeaving BETWEEN ? AND ?)
       ORDER BY COALESCE(e.dateOfLeaving, e.dateOfJoining)
       LIMIT ?`,
      [from, to, from, to, from, to, ctx.limit],
    );
    return {
      columns: [
        { key: 'event', label: 'Event' },
        { key: 'code', label: 'Emp code' },
        { key: 'name', label: 'Name' },
        { key: 'department', label: 'Department' },
        { key: 'designation', label: 'Designation' },
        { key: 'dateOfJoining', label: 'Joined', type: 'date' },
        { key: 'dateOfLeaving', label: 'Left', type: 'date' },
      ],
      rows,
      meta: { from, to },
    };
  },
};

const paymentRegister: ReportDef = {
  key: 'payment-register',
  name: 'Payment / collection register',
  category: 'Finance',
  roles: FINANCE_ROLES,
  params: [
    { key: 'from', label: 'From', type: 'date', required: true },
    { key: 'to', label: 'To', type: 'date', required: true },
    {
      key: 'kind',
      label: 'Kind',
      type: 'select',
      options: ['INVOICE', 'RECEIPT', 'CREDIT_NOTE', 'ADJUSTMENT'].map((v) => ({
        value: v,
        label: v,
      })),
    },
    {
      key: 'method',
      label: 'Method',
      type: 'select',
      options: ['CASH', 'CHEQUE', 'NEFT', 'RTGS', 'UPI', 'CARD', 'OTHER'].map(
        (v) => ({ value: v, label: v }),
      ),
    },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const from = reqDate(params, 'from');
    const to = reqDate(params, 'to');
    const where = ['p.paymentDate BETWEEN ? AND ?'];
    const args: unknown[] = [from, to];
    opt(params, 'kind', 'p.kind', where, args);
    opt(params, 'method', 'p.method', where, args);

    const rows: Array<Record<string, string>> = await ctx.ds.query(
      `SELECT DATE_FORMAT(p.paymentDate,'%Y-%m-%d') AS paymentDate,
              c.code AS customerCode, c.name AS customerName,
              p.kind, p.amount, p.method, p.referenceNo, p.status, p.notes
       FROM payments p JOIN customers c ON c.id = p.customerId
       WHERE ${where.join(' AND ')}
       ORDER BY p.paymentDate, p.id
       LIMIT ?`,
      [...args, ctx.limit],
    );
    const totals: Array<Record<string, string>> = await ctx.ds.query(
      `SELECT p.kind, SUM(p.amount) AS total, COUNT(*) AS count
       FROM payments p
       WHERE ${where.join(' AND ')}
       GROUP BY p.kind`,
      args,
    );
    return {
      columns: [
        { key: 'paymentDate', label: 'Date', type: 'date' },
        { key: 'customerCode', label: 'Cust code' },
        { key: 'customerName', label: 'Customer' },
        { key: 'kind', label: 'Kind' },
        { key: 'amount', label: 'Amount', type: 'money' },
        { key: 'method', label: 'Method' },
        { key: 'referenceNo', label: 'Reference' },
        { key: 'status', label: 'Status' },
        { key: 'notes', label: 'Notes' },
      ],
      rows,
      meta: {
        from,
        to,
        totalsByKind: totals.map((t) => ({
          kind: t.kind,
          total: t.total,
          count: Number(t.count),
        })),
      },
    };
  },
};

const dailyCollection: ReportDef = {
  key: 'daily-collection',
  name: 'Daily / monthly collection summary',
  category: 'Finance',
  roles: FINANCE_ROLES,
  params: [
    { key: 'from', label: 'From', type: 'date', required: true },
    { key: 'to', label: 'To', type: 'date', required: true },
    {
      key: 'groupBy',
      label: 'Group by',
      type: 'select',
      default: 'day',
      options: [
        { value: 'day', label: 'Day' },
        { value: 'month', label: 'Month' },
      ],
    },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const from = reqDate(params, 'from');
    const to = reqDate(params, 'to');
    const fmt = params.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
    const rows: Array<Record<string, string>> = await ctx.ds.query(
      `SELECT DATE_FORMAT(p.paymentDate, ?) AS bucket,
              SUM(CASE WHEN p.kind='INVOICE' THEN p.amount ELSE 0 END) AS invoiced,
              SUM(CASE WHEN p.kind='RECEIPT' THEN p.amount ELSE 0 END) AS received,
              SUM(CASE WHEN p.kind='CREDIT_NOTE' THEN p.amount ELSE 0 END) AS creditNotes,
              COUNT(*) AS count
       FROM payments p
       WHERE p.paymentDate BETWEEN ? AND ?
       GROUP BY bucket ORDER BY bucket
       LIMIT ?`,
      [fmt, from, to, ctx.limit],
    );
    return {
      columns: [
        { key: 'bucket', label: 'Period' },
        { key: 'invoiced', label: 'Invoiced', type: 'money' },
        { key: 'received', label: 'Received', type: 'money' },
        { key: 'creditNotes', label: 'Credit notes', type: 'money' },
        { key: 'count', label: 'Entries', type: 'number' },
      ],
      rows,
      meta: { from, to, groupBy: params.groupBy ?? 'day' },
    };
  },
};

const customerAgeing: ReportDef = {
  key: 'customer-ageing',
  name: 'Customer outstanding ageing',
  category: 'Finance',
  description:
    'Outstanding bucketed by age of the oldest open invoice (approx, not per-invoice FIFO).',
  roles: FINANCE_ROLES,
  params: [
    { key: 'territory', label: 'Territory', type: 'text' },
    { key: 'state', label: 'State', type: 'text' },
    {
      key: 'minOutstanding',
      label: 'Min outstanding',
      type: 'number',
      default: '0.01',
    },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const min = params.minOutstanding && Number(params.minOutstanding) >= 0
      ? params.minOutstanding
      : '0.01';
    const where = ['c.deletedAt IS NULL', 'c.outstandingBalance >= ?'];
    const args: unknown[] = [min];
    opt(params, 'territory', 'c.territory', where, args);
    opt(params, 'state', 'c.state', where, args);

    const raw: Array<Record<string, string>> = await ctx.ds.query(
      `SELECT c.code, c.name, c.territory, c.state, c.outstandingBalance,
              DATEDIFF(CURDATE(), MIN(p.paymentDate)) AS ageDays
       FROM customers c
       LEFT JOIN payments p
         ON p.customerId = c.id AND p.kind = 'INVOICE'
        AND p.status IN ('PENDING','CLEARED')
       WHERE ${where.join(' AND ')}
       GROUP BY c.id
       ORDER BY c.outstandingBalance DESC
       LIMIT ?`,
      [...args, ctx.limit],
    );

    const bucketOf = (age: number | null): string => {
      if (age === null || Number.isNaN(age)) return 'b0';
      if (age <= 30) return 'b0';
      if (age <= 60) return 'b1';
      if (age <= 90) return 'b2';
      return 'b3';
    };
    let t0 = 0;
    let t1 = 0;
    let t2 = 0;
    let t3 = 0;
    const rows = raw.map((c) => {
      const bal = Number(c.outstandingBalance);
      const b = bucketOf(c.ageDays === null ? null : Number(c.ageDays));
      const row: Record<string, unknown> = {
        code: c.code,
        name: c.name,
        territory: c.territory ?? '',
        state: c.state ?? '',
        outstanding: c.outstandingBalance,
        b0: '0.00',
        b1: '0.00',
        b2: '0.00',
        b3: '0.00',
      };
      row[b] = c.outstandingBalance;
      if (b === 'b0') t0 += bal;
      else if (b === 'b1') t1 += bal;
      else if (b === 'b2') t2 += bal;
      else t3 += bal;
      return row;
    });

    return {
      columns: [
        { key: 'code', label: 'Cust code' },
        { key: 'name', label: 'Customer' },
        { key: 'territory', label: 'Territory' },
        { key: 'state', label: 'State' },
        { key: 'outstanding', label: 'Outstanding', type: 'money' },
        { key: 'b0', label: '0-30', type: 'money' },
        { key: 'b1', label: '31-60', type: 'money' },
        { key: 'b2', label: '61-90', type: 'money' },
        { key: 'b3', label: '90+', type: 'money' },
      ],
      rows,
      meta: {
        totals: {
          '0-30': t0.toFixed(2),
          '31-60': t1.toFixed(2),
          '61-90': t2.toFixed(2),
          '90+': t3.toFixed(2),
        },
      },
    };
  },
};

const customerStatement: ReportDef = {
  key: 'customer-statement',
  name: 'Customer statement',
  category: 'Finance',
  roles: READ_ROLES,
  params: [
    { key: 'customerId', label: 'Customer id', type: 'number', required: true },
    { key: 'from', label: 'From', type: 'date', required: true },
    { key: 'to', label: 'To', type: 'date', required: true },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const customerId = need(params, 'customerId');
    const from = reqDate(params, 'from');
    const to = reqDate(params, 'to');
    const st = await ctx.services.statement(customerId, from, to);
    return {
      columns: [
        { key: 'paymentDate', label: 'Date', type: 'date' },
        { key: 'kind', label: 'Kind' },
        { key: 'referenceNo', label: 'Reference' },
        { key: 'amount', label: 'Amount', type: 'money' },
        { key: 'runningBalance', label: 'Running balance', type: 'money' },
      ],
      rows: st.lines,
      meta: {
        openingBalance: st.openingBalance,
        closingBalance: st.closingBalance,
        currentBalance: st.currentBalance,
      },
    };
  },
};

const customerMaster: ReportDef = {
  key: 'customer-master',
  name: 'Customer master',
  category: 'CRM',
  roles: READ_ROLES,
  params: [
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      options: [
        'CHEMIST',
        'STOCKIST',
        'HOSPITAL',
        'DOCTOR',
        'INSTITUTION',
        'INDIVIDUAL',
      ].map((v) => ({ value: v, label: v })),
    },
    { key: 'state', label: 'State', type: 'text' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: ['ACTIVE', 'INACTIVE', 'BLOCKED'].map((v) => ({
        value: v,
        label: v,
      })),
    },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const where = ['deletedAt IS NULL'];
    const args: unknown[] = [];
    opt(params, 'type', 'type', where, args);
    opt(params, 'state', 'state', where, args);
    opt(params, 'status', 'status', where, args);
    const rows: Array<Record<string, string>> = await ctx.ds.query(
      `SELECT code, name, type, phone, email, gstin, city, state, pincode,
              territory, creditLimit, outstandingBalance, status,
              DATE_FORMAT(createdAt,'%Y-%m-%d') AS createdOn
       FROM customers
       WHERE ${where.join(' AND ')}
       ORDER BY id DESC
       LIMIT ?`,
      [...args, ctx.limit],
    );
    return {
      columns: [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'type', label: 'Type' },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email' },
        { key: 'gstin', label: 'GSTIN' },
        { key: 'city', label: 'City' },
        { key: 'state', label: 'State' },
        { key: 'pincode', label: 'Pincode' },
        { key: 'territory', label: 'Territory' },
        { key: 'creditLimit', label: 'Credit limit', type: 'money' },
        { key: 'outstandingBalance', label: 'Outstanding', type: 'money' },
        { key: 'status', label: 'Status' },
        { key: 'createdOn', label: 'Created', type: 'date' },
      ],
      rows,
    };
  },
};

const doctorMaster: ReportDef = {
  key: 'doctor-master',
  name: 'Doctor master',
  category: 'CRM',
  roles: READ_ROLES,
  params: [
    { key: 'speciality', label: 'Speciality', type: 'text' },
    { key: 'city', label: 'City', type: 'text' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: ['ACTIVE', 'INACTIVE'].map((v) => ({ value: v, label: v })),
    },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const where = ['deletedAt IS NULL'];
    const args: unknown[] = [];
    opt(params, 'speciality', 'speciality', where, args);
    opt(params, 'city', 'city', where, args);
    opt(params, 'status', 'status', where, args);
    const rows: Array<Record<string, string>> = await ctx.ds.query(
      `SELECT code, name, speciality, registrationNo, qualification, phone, email,
              hospitalName, city, state, territory, status
       FROM doctors
       WHERE ${where.join(' AND ')}
       ORDER BY id DESC
       LIMIT ?`,
      [...args, ctx.limit],
    );
    return {
      columns: [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'speciality', label: 'Speciality' },
        { key: 'registrationNo', label: 'Reg. no.' },
        { key: 'qualification', label: 'Qualification' },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email' },
        { key: 'hospitalName', label: 'Hospital' },
        { key: 'city', label: 'City' },
        { key: 'state', label: 'State' },
        { key: 'territory', label: 'Territory' },
        { key: 'status', label: 'Status' },
      ],
      rows,
    };
  },
};

// ---- Field / MR reports ------------------------------------------------

const FIELD_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.SALES_MANAGER,
];

const mrCallReport: ReportDef = {
  key: 'mr-call-report',
  name: 'MR call report (DCR)',
  category: 'Field',
  roles: FIELD_ROLES,
  params: [
    { key: 'from', label: 'From', type: 'date', required: true },
    { key: 'to', label: 'To', type: 'date', required: true },
    { key: 'repEmployeeId', label: 'Rep employee id', type: 'number' },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const from = reqDate(params, 'from');
    const to = reqDate(params, 'to');
    const where = ['cr.callDate BETWEEN ? AND ?'];
    const args: unknown[] = [from, to];
    opt(params, 'repEmployeeId', 'cr.repEmployeeId', where, args);
    const rows = await ctx.ds.query(
      `SELECT e.code AS repCode, CONCAT(e.firstName,' ',e.lastName) AS repName,
              DATE_FORMAT(cr.callDate,'%Y-%m-%d') AS callDate, cr.kind,
              COALESCE(d.name, c.name) AS party, cr.area,
              CASE WHEN cr.wasPlanned THEN 'Y' ELSE 'N' END AS planned,
              cr.pobValue,
              (SELECT COUNT(*) FROM call_products cp
                 WHERE cp.callReportId = cr.id AND cp.action IN ('SAMPLE','GIFT')) AS sampleLines
       FROM call_reports cr
       JOIN employees e ON e.id = cr.repEmployeeId
       LEFT JOIN doctors d ON d.id = cr.doctorId
       LEFT JOIN customers c ON c.id = cr.customerId
       WHERE ${where.join(' AND ')}
       ORDER BY cr.callDate, e.code
       LIMIT ?`,
      [...args, ctx.limit],
    );
    return {
      columns: [
        { key: 'repCode', label: 'Rep' },
        { key: 'repName', label: 'Rep name' },
        { key: 'callDate', label: 'Date', type: 'date' },
        { key: 'kind', label: 'Kind' },
        { key: 'party', label: 'Doctor / Chemist' },
        { key: 'area', label: 'Area' },
        { key: 'planned', label: 'Planned' },
        { key: 'sampleLines', label: 'Sample lines', type: 'number' },
        { key: 'pobValue', label: 'POB value', type: 'money' },
      ],
      rows,
      meta: { from, to },
    };
  },
};

const mrTourCompliance: ReportDef = {
  key: 'mr-tour-compliance',
  name: 'Tour plan vs actual',
  category: 'Field',
  roles: FIELD_ROLES,
  params: [{ key: 'periodMonth', label: 'Month', type: 'month', required: true }],
  async run(params, ctx): Promise<ReportResult> {
    const periodMonth = reqMonth(params, 'periodMonth');
    const { from, to } = monthDateRange(periodMonth);
    const rows: Array<Record<string, string>> = await ctx.ds.query(
      `SELECT e.code AS repCode, CONCAT(e.firstName,' ',e.lastName) AS repName,
              COALESCE((SELECT SUM(dd.plannedCalls)
                 FROM tour_plans tp JOIN tour_plan_days dd ON dd.tourPlanId = tp.id
                 WHERE tp.repEmployeeId = fr.employeeId AND tp.periodMonth = ?), 0) AS planned,
              (SELECT COUNT(*) FROM call_reports cr
                 WHERE cr.repEmployeeId = fr.employeeId
                   AND cr.callDate BETWEEN ? AND ?) AS actual,
              (SELECT COUNT(DISTINCT cr.doctorId) FROM call_reports cr
                 WHERE cr.repEmployeeId = fr.employeeId
                   AND cr.callDate BETWEEN ? AND ?) AS doctorsMet,
              (SELECT COUNT(*) FROM doctors d
                 WHERE d.assignedRepEmployeeId = fr.employeeId AND d.deletedAt IS NULL) AS doctorsAssigned
       FROM field_reps fr
       JOIN employees e ON e.id = fr.employeeId
       WHERE fr.active = 1
       ORDER BY e.code
       LIMIT ?`,
      [periodMonth, from, to, from, to, ctx.limit],
    );
    const out = rows.map((r) => {
      const planned = Number(r.planned);
      const actual = Number(r.actual);
      const dm = Number(r.doctorsMet);
      const da = Number(r.doctorsAssigned);
      return {
        repCode: r.repCode,
        repName: r.repName,
        planned,
        actual,
        compliancePct: planned ? Math.round((actual / planned) * 100) : 0,
        coveragePct: da ? Math.round((dm / da) * 100) : 0,
      };
    });
    return {
      columns: [
        { key: 'repCode', label: 'Rep' },
        { key: 'repName', label: 'Rep name' },
        { key: 'planned', label: 'Planned', type: 'number' },
        { key: 'actual', label: 'Actual', type: 'number' },
        { key: 'compliancePct', label: 'Compliance %', type: 'number' },
        { key: 'coveragePct', label: 'Coverage %', type: 'number' },
      ],
      rows: out,
      meta: { periodMonth },
    };
  },
};

const mrPobSummary: ReportDef = {
  key: 'mr-pob-summary',
  name: 'POB summary',
  category: 'Field',
  roles: FIELD_ROLES,
  params: [
    { key: 'from', label: 'From', type: 'date', required: true },
    { key: 'to', label: 'To', type: 'date', required: true },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const from = reqDate(params, 'from');
    const to = reqDate(params, 'to');
    const rows = await ctx.ds.query(
      `SELECT e.code AS repCode, CONCAT(e.firstName,' ',e.lastName) AS repName,
              COUNT(cr.id) AS calls,
              SUM(CASE WHEN cr.pobValue > 0 THEN 1 ELSE 0 END) AS ordersBooked,
              COALESCE(SUM(cr.pobValue), 0) AS pobValue
       FROM call_reports cr
       JOIN employees e ON e.id = cr.repEmployeeId
       WHERE cr.callDate BETWEEN ? AND ?
       GROUP BY cr.repEmployeeId
       ORDER BY pobValue DESC
       LIMIT ?`,
      [from, to, ctx.limit],
    );
    return {
      columns: [
        { key: 'repCode', label: 'Rep' },
        { key: 'repName', label: 'Rep name' },
        { key: 'calls', label: 'Calls', type: 'number' },
        { key: 'ordersBooked', label: 'Orders', type: 'number' },
        { key: 'pobValue', label: 'POB value', type: 'money' },
      ],
      rows,
      meta: { from, to },
    };
  },
};

const mrSampleAccount: ReportDef = {
  key: 'mr-sample-account',
  name: 'Sample / gift account',
  category: 'Field',
  roles: FIELD_ROLES,
  params: [{ key: 'repEmployeeId', label: 'Rep employee id', type: 'number' }],
  async run(params, ctx): Promise<ReportResult> {
    const where: string[] = [];
    const args: unknown[] = [];
    opt(params, 'repEmployeeId', 'sm.repEmployeeId', where, args);
    const rows: Array<Record<string, string>> = await ctx.ds.query(
      `SELECT e.code AS repCode, pi.code AS itemCode, pi.name AS itemName, pi.type,
              SUM(CASE WHEN sm.kind = 'ISSUE' THEN sm.qty ELSE 0 END) AS issued,
              SUM(CASE WHEN sm.kind = 'DISTRIBUTE' THEN -sm.qty ELSE 0 END) AS distributed,
              SUM(CASE WHEN sm.kind = 'RETURN' THEN -sm.qty ELSE 0 END) AS returned,
              SUM(sm.qty) AS balance
       FROM stock_movements sm
       JOIN promo_items pi ON pi.id = sm.promoItemId
       JOIN employees e ON e.id = sm.repEmployeeId
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       GROUP BY sm.repEmployeeId, sm.promoItemId
       ORDER BY e.code, pi.code
       LIMIT ?`,
      [...args, ctx.limit],
    );
    return {
      columns: [
        { key: 'repCode', label: 'Rep' },
        { key: 'itemCode', label: 'Item' },
        { key: 'itemName', label: 'Name' },
        { key: 'type', label: 'Type' },
        { key: 'issued', label: 'Issued', type: 'number' },
        { key: 'distributed', label: 'Distributed', type: 'number' },
        { key: 'returned', label: 'Returned', type: 'number' },
        { key: 'balance', label: 'Balance', type: 'number' },
      ],
      rows: rows.map((r) => ({ ...r, negative: Number(r.balance) < 0 })),
    };
  },
};

// ---- Clinical / patient reports -------------------------------------

const CLINIC_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.RECEPTION];

const patientRegister: ReportDef = {
  key: 'patient-register',
  name: 'Patient register',
  category: 'Clinical',
  roles: CLINIC_ROLES,
  params: [
    { key: 'from', label: 'From', type: 'date', required: true },
    { key: 'to', label: 'To', type: 'date', required: true },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const from = reqDate(params, 'from');
    const to = reqDate(params, 'to');
    const rows = await ctx.ds.query(
      `SELECT p.code, CONCAT(p.firstName,' ',p.lastName) AS name, p.gender,
              TIMESTAMPDIFF(YEAR, p.dateOfBirth, CURDATE()) AS age,
              p.phone, p.city, p.status,
              DATE_FORMAT(p.registrationDate,'%Y-%m-%d') AS registeredOn,
              d.name AS assignedDoctor
       FROM patients p LEFT JOIN doctors d ON d.id = p.assignedDoctorId
       WHERE p.deletedAt IS NULL AND p.registrationDate BETWEEN ? AND ?
       ORDER BY p.registrationDate, p.id
       LIMIT ?`,
      [from, to, ctx.limit],
    );
    return {
      columns: [
        { key: 'code', label: 'UHID' },
        { key: 'name', label: 'Name' },
        { key: 'gender', label: 'Gender' },
        { key: 'age', label: 'Age', type: 'number' },
        { key: 'phone', label: 'Phone' },
        { key: 'city', label: 'City' },
        { key: 'assignedDoctor', label: 'Assigned doctor' },
        { key: 'status', label: 'Status' },
        { key: 'registeredOn', label: 'Registered', type: 'date' },
      ],
      rows,
      meta: { from, to },
    };
  },
};

const appointmentRegister: ReportDef = {
  key: 'appointment-register',
  name: 'Appointment register',
  category: 'Clinical',
  roles: CLINIC_ROLES,
  params: [
    { key: 'from', label: 'From', type: 'date', required: true },
    { key: 'to', label: 'To', type: 'date', required: true },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        'SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS',
        'COMPLETED', 'CANCELLED', 'NO_SHOW',
      ].map((v) => ({ value: v, label: v })),
    },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const from = reqDate(params, 'from');
    const to = reqDate(params, 'to');
    const where = ['a.scheduledAt >= ? AND a.scheduledAt < ?'];
    const args: unknown[] = [from, `${to} 23:59:59`];
    opt(params, 'status', 'a.status', where, args);
    const rows = await ctx.ds.query(
      `SELECT DATE_FORMAT(a.scheduledAt,'%Y-%m-%d %H:%i') AS scheduledAt,
              p.code AS patientCode, CONCAT(p.firstName,' ',p.lastName) AS patient,
              d.name AS doctor, a.type, a.status, a.reason
       FROM appointments a
       JOIN patients p ON p.id = a.patientId
       LEFT JOIN doctors d ON d.id = a.doctorId
       WHERE ${where.join(' AND ')}
       ORDER BY a.scheduledAt
       LIMIT ?`,
      [...args, ctx.limit],
    );
    return {
      columns: [
        { key: 'scheduledAt', label: 'Scheduled' },
        { key: 'patientCode', label: 'UHID' },
        { key: 'patient', label: 'Patient' },
        { key: 'doctor', label: 'Doctor' },
        { key: 'type', label: 'Type' },
        { key: 'status', label: 'Status' },
        { key: 'reason', label: 'Reason' },
      ],
      rows,
      meta: { from, to },
    };
  },
};

const doctorProductivity: ReportDef = {
  key: 'doctor-productivity',
  name: 'Doctor productivity',
  category: 'Clinical',
  roles: CLINIC_ROLES,
  params: [{ key: 'periodMonth', label: 'Month', type: 'month', required: true }],
  async run(params, ctx): Promise<ReportResult> {
    const periodMonth = reqMonth(params, 'periodMonth');
    const { from, to } = monthDateRange(periodMonth);
    const rows = await ctx.ds.query(
      `SELECT d.name AS doctor, d.code AS doctorCode,
              (SELECT COUNT(*) FROM appointments a
                 WHERE a.doctorId = d.id AND a.scheduledAt >= ? AND a.scheduledAt < ?) AS appointments,
              (SELECT COUNT(*) FROM appointments a
                 WHERE a.doctorId = d.id AND a.status = 'COMPLETED'
                   AND a.scheduledAt >= ? AND a.scheduledAt < ?) AS completed,
              (SELECT COUNT(*) FROM visits v
                 WHERE v.doctorId = d.id AND v.visitDate >= ? AND v.visitDate < ?) AS visits,
              (SELECT COUNT(DISTINCT v.patientId) FROM visits v
                 WHERE v.doctorId = d.id AND v.visitDate >= ? AND v.visitDate < ?) AS uniquePatients,
              (SELECT COALESCE(SUM(c.amount),0) FROM patient_charges c
                 JOIN visits v ON v.id = c.visitId
                 WHERE v.doctorId = d.id AND c.kind = 'INVOICE'
                   AND c.chargeDate BETWEEN ? AND ?) AS revenue
       FROM doctors d
       WHERE d.deletedAt IS NULL
       ORDER BY visits DESC
       LIMIT ?`,
      [from, `${to} 23:59:59`, from, `${to} 23:59:59`, from, `${to} 23:59:59`,
       from, `${to} 23:59:59`, from, to, ctx.limit],
    );
    return {
      columns: [
        { key: 'doctorCode', label: 'Code' },
        { key: 'doctor', label: 'Doctor' },
        { key: 'appointments', label: 'Appts', type: 'number' },
        { key: 'completed', label: 'Completed', type: 'number' },
        { key: 'visits', label: 'Visits', type: 'number' },
        { key: 'uniquePatients', label: 'Unique patients', type: 'number' },
        { key: 'revenue', label: 'Revenue', type: 'money' },
      ],
      rows,
      meta: { periodMonth },
    };
  },
};

const patientOutstandingAgeing: ReportDef = {
  key: 'patient-outstanding-ageing',
  name: 'Patient outstanding ageing',
  category: 'Clinical',
  roles: CLINIC_ROLES,
  params: [
    {
      key: 'minOutstanding',
      label: 'Min outstanding',
      type: 'number',
      default: '0.01',
    },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const min =
      params.minOutstanding && Number(params.minOutstanding) >= 0
        ? params.minOutstanding
        : '0.01';
    const raw: Array<Record<string, string>> = await ctx.ds.query(
      `SELECT p.code, CONCAT(p.firstName,' ',p.lastName) AS name, p.phone,
              p.outstandingBalance,
              DATEDIFF(CURDATE(), MIN(c.chargeDate)) AS ageDays
       FROM patients p
       LEFT JOIN patient_charges c
         ON c.patientId = p.id AND c.kind = 'INVOICE' AND c.status IN ('PENDING','CLEARED')
       WHERE p.deletedAt IS NULL AND p.outstandingBalance >= ?
       GROUP BY p.id
       ORDER BY p.outstandingBalance DESC
       LIMIT ?`,
      [min, ctx.limit],
    );
    const b = (age: number | null) =>
      age == null || Number.isNaN(age)
        ? 'b0'
        : age <= 30
          ? 'b0'
          : age <= 60
            ? 'b1'
            : age <= 90
              ? 'b2'
              : 'b3';
    const rows = raw.map((r) => {
      const bucket = b(r.ageDays == null ? null : Number(r.ageDays));
      return {
        code: r.code,
        name: r.name,
        phone: r.phone ?? '',
        outstanding: r.outstandingBalance,
        b0: bucket === 'b0' ? r.outstandingBalance : '0.00',
        b1: bucket === 'b1' ? r.outstandingBalance : '0.00',
        b2: bucket === 'b2' ? r.outstandingBalance : '0.00',
        b3: bucket === 'b3' ? r.outstandingBalance : '0.00',
      };
    });
    return {
      columns: [
        { key: 'code', label: 'UHID' },
        { key: 'name', label: 'Patient' },
        { key: 'phone', label: 'Phone' },
        { key: 'outstanding', label: 'Outstanding', type: 'money' },
        { key: 'b0', label: '0-30', type: 'money' },
        { key: 'b1', label: '31-60', type: 'money' },
        { key: 'b2', label: '61-90', type: 'money' },
        { key: 'b3', label: '90+', type: 'money' },
      ],
      rows,
    };
  },
};

const clinicRevenue: ReportDef = {
  key: 'clinic-revenue',
  name: 'Clinic revenue',
  category: 'Clinical',
  roles: CLINIC_ROLES,
  params: [
    { key: 'from', label: 'From', type: 'date', required: true },
    { key: 'to', label: 'To', type: 'date', required: true },
    {
      key: 'groupBy',
      label: 'Group by',
      type: 'select',
      default: 'day',
      options: [
        { value: 'day', label: 'Day' },
        { value: 'month', label: 'Month' },
      ],
    },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const from = reqDate(params, 'from');
    const to = reqDate(params, 'to');
    const fmt = params.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
    const rows = await ctx.ds.query(
      `SELECT DATE_FORMAT(chargeDate, ?) AS bucket,
              SUM(CASE WHEN serviceKind='CONSULTATION' THEN amount ELSE 0 END) AS consultation,
              SUM(CASE WHEN serviceKind='PROCEDURE' THEN amount ELSE 0 END) AS procedureAmt,
              SUM(CASE WHEN serviceKind='LAB' THEN amount ELSE 0 END) AS lab,
              SUM(CASE WHEN serviceKind='PHARMACY' THEN amount ELSE 0 END) AS pharmacy,
              SUM(amount) AS total
       FROM patient_charges
       WHERE kind = 'INVOICE' AND chargeDate BETWEEN ? AND ?
       GROUP BY bucket ORDER BY bucket
       LIMIT ?`,
      [fmt, from, to, ctx.limit],
    );
    return {
      columns: [
        { key: 'bucket', label: 'Period' },
        { key: 'consultation', label: 'Consultation', type: 'money' },
        { key: 'procedureAmt', label: 'Procedure', type: 'money' },
        { key: 'lab', label: 'Lab', type: 'money' },
        { key: 'pharmacy', label: 'Pharmacy', type: 'money' },
        { key: 'total', label: 'Total', type: 'money' },
      ],
      rows,
      meta: { from, to, groupBy: params.groupBy ?? 'day' },
    };
  },
};

const prescriptionsIssued: ReportDef = {
  key: 'prescriptions-issued',
  name: 'Prescriptions issued',
  category: 'Clinical',
  roles: CLINIC_ROLES,
  params: [
    { key: 'from', label: 'From', type: 'date', required: true },
    { key: 'to', label: 'To', type: 'date', required: true },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const from = reqDate(params, 'from');
    const to = reqDate(params, 'to');
    const rows = await ctx.ds.query(
      `SELECT d.name AS doctor, d.code AS doctorCode,
              COUNT(rx.id) AS prescriptions,
              (SELECT COUNT(*) FROM prescription_items pi
                 JOIN prescriptions r2 ON r2.id = pi.prescriptionId
                 WHERE r2.doctorId = d.id
                   AND r2.prescribedAt >= ? AND r2.prescribedAt < ?) AS drugLines
       FROM doctors d
       LEFT JOIN prescriptions rx
         ON rx.doctorId = d.id AND rx.prescribedAt >= ? AND rx.prescribedAt < ?
       WHERE d.deletedAt IS NULL
       GROUP BY d.id
       ORDER BY prescriptions DESC
       LIMIT ?`,
      [from, `${to} 23:59:59`, from, `${to} 23:59:59`, ctx.limit],
    );
    return {
      columns: [
        { key: 'doctorCode', label: 'Code' },
        { key: 'doctor', label: 'Doctor' },
        { key: 'prescriptions', label: 'Prescriptions', type: 'number' },
        { key: 'drugLines', label: 'Drug lines', type: 'number' },
      ],
      rows,
      meta: { from, to },
    };
  },
};

// ---------------------------------------------------------------------------
// Pharmacy
// ---------------------------------------------------------------------------

const PHARMACY_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.PHARMACIST];

const pharmacyStock: ReportDef = {
  key: 'pharmacy-stock',
  name: 'Pharmacy stock on hand',
  category: 'Pharmacy',
  description: 'Per drug: on-hand quantity, batch count, stock value, reorder flag.',
  roles: PHARMACY_ROLES,
  params: [],
  async run(_params, ctx): Promise<ReportResult> {
    const rows = await ctx.ds.query(
      `SELECT d.code, d.name, d.form, d.unit, d.reorderLevel,
              COALESCE(SUM(b.quantityOnHand), 0) AS onHand,
              COALESCE(SUM(CASE WHEN b.quantityOnHand > 0 THEN 1 ELSE 0 END), 0) AS batches,
              COALESCE(SUM(b.quantityOnHand * b.purchasePrice), 0) AS stockValue,
              CASE WHEN COALESCE(SUM(b.quantityOnHand), 0) <= d.reorderLevel
                   THEN 'YES' ELSE '' END AS reorder
       FROM drugs d
       LEFT JOIN drug_batches b ON b.drugId = d.id
       WHERE d.deletedAt IS NULL
       GROUP BY d.id
       ORDER BY d.name
       LIMIT ?`,
      [ctx.limit],
    );
    return {
      columns: [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Drug' },
        { key: 'form', label: 'Form' },
        { key: 'unit', label: 'Unit' },
        { key: 'onHand', label: 'On hand', type: 'number' },
        { key: 'batches', label: 'Batches', type: 'number' },
        { key: 'reorderLevel', label: 'Reorder level', type: 'number' },
        { key: 'reorder', label: 'Reorder?' },
        { key: 'stockValue', label: 'Stock value', type: 'money' },
      ],
      rows,
    };
  },
};

const expiryReport: ReportDef = {
  key: 'expiry-report',
  name: 'Expiring stock',
  category: 'Pharmacy',
  description: 'Batches expiring within N days that still have stock.',
  roles: PHARMACY_ROLES,
  params: [
    { key: 'days', label: 'Within days', type: 'number', default: '90' },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const days = Math.max(1, Math.min(3650, Number(params.days ?? '90') || 90));
    const rows = await ctx.ds.query(
      `SELECT d.code, d.name, b.batchNo,
              DATE_FORMAT(b.expiryDate,'%Y-%m-%d') AS expiryDate,
              DATEDIFF(b.expiryDate, CURDATE()) AS daysToExpiry,
              b.quantityOnHand AS onHand,
              (b.quantityOnHand * b.purchasePrice) AS valueAtRisk
       FROM drug_batches b
       JOIN drugs d ON d.id = b.drugId
       WHERE b.quantityOnHand > 0
         AND b.expiryDate <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY b.expiryDate ASC
       LIMIT ?`,
      [days, ctx.limit],
    );
    return {
      columns: [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Drug' },
        { key: 'batchNo', label: 'Batch' },
        { key: 'expiryDate', label: 'Expiry', type: 'date' },
        { key: 'daysToExpiry', label: 'Days left', type: 'number' },
        { key: 'onHand', label: 'On hand', type: 'number' },
        { key: 'valueAtRisk', label: 'Value at risk', type: 'money' },
      ],
      rows,
      meta: { days },
    };
  },
};

const dispenseRegister: ReportDef = {
  key: 'dispense-register',
  name: 'Dispense register',
  category: 'Pharmacy',
  roles: PHARMACY_ROLES,
  params: [
    { key: 'from', label: 'From', type: 'date', required: true },
    { key: 'to', label: 'To', type: 'date', required: true },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const from = reqDate(params, 'from');
    const to = reqDate(params, 'to');
    const rows = await ctx.ds.query(
      `SELECT ds.dispenseNo,
              DATE_FORMAT(ds.dispensedAt,'%Y-%m-%d %H:%i') AS dispensedAt,
              CONCAT(p.firstName,' ',p.lastName) AS patient,
              ds.status,
              (SELECT COUNT(*) FROM dispense_items di WHERE di.dispenseId = ds.id) AS items,
              ds.discount, ds.total
       FROM dispenses ds
       JOIN patients p ON p.id = ds.patientId
       WHERE ds.dispensedAt >= ? AND ds.dispensedAt <= ?
       ORDER BY ds.dispensedAt DESC
       LIMIT ?`,
      [`${from} 00:00:00`, `${to} 23:59:59`, ctx.limit],
    );
    return {
      columns: [
        { key: 'dispenseNo', label: 'Dispense #' },
        { key: 'dispensedAt', label: 'When', type: 'text' },
        { key: 'patient', label: 'Patient' },
        { key: 'status', label: 'Status' },
        { key: 'items', label: 'Items', type: 'number' },
        { key: 'discount', label: 'Discount', type: 'money' },
        { key: 'total', label: 'Total', type: 'money' },
      ],
      rows,
      meta: { from, to },
    };
  },
};

const purchaseRegister: ReportDef = {
  key: 'purchase-register',
  name: 'Purchase register (GRN)',
  category: 'Pharmacy',
  roles: PHARMACY_ROLES,
  params: [
    { key: 'from', label: 'From', type: 'date', required: true },
    { key: 'to', label: 'To', type: 'date', required: true },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const from = reqDate(params, 'from');
    const to = reqDate(params, 'to');
    const rows = await ctx.ds.query(
      `SELECT g.grnNo,
              DATE_FORMAT(g.receivedDate,'%Y-%m-%d') AS receivedDate,
              s.name AS supplier, g.invoiceNo,
              DATE_FORMAT(g.invoiceDate,'%Y-%m-%d') AS invoiceDate,
              g.status, g.subtotal, g.gstAmount, g.total
       FROM grns g
       JOIN suppliers s ON s.id = g.supplierId
       WHERE g.receivedDate >= ? AND g.receivedDate <= ?
       ORDER BY g.receivedDate DESC
       LIMIT ?`,
      [from, to, ctx.limit],
    );
    return {
      columns: [
        { key: 'grnNo', label: 'GRN #' },
        { key: 'receivedDate', label: 'Received', type: 'date' },
        { key: 'supplier', label: 'Supplier' },
        { key: 'invoiceNo', label: 'Invoice #' },
        { key: 'invoiceDate', label: 'Invoice date', type: 'date' },
        { key: 'status', label: 'Status' },
        { key: 'subtotal', label: 'Subtotal', type: 'money' },
        { key: 'gstAmount', label: 'GST', type: 'money' },
        { key: 'total', label: 'Total', type: 'money' },
      ],
      rows,
      meta: { from, to },
    };
  },
};

const drugMovement: ReportDef = {
  key: 'drug-movement',
  name: 'Drug movement ledger',
  category: 'Pharmacy',
  description: 'Every stock movement for one drug in a date range.',
  roles: PHARMACY_ROLES,
  params: [
    { key: 'drugId', label: 'Drug id', type: 'number', required: true },
    { key: 'from', label: 'From', type: 'date', required: true },
    { key: 'to', label: 'To', type: 'date', required: true },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const drugId = need(params, 'drugId');
    const from = reqDate(params, 'from');
    const to = reqDate(params, 'to');
    const rows = await ctx.ds.query(
      `SELECT DATE_FORMAT(m.movementDate,'%Y-%m-%d') AS movementDate,
              m.kind, b.batchNo,
              DATE_FORMAT(b.expiryDate,'%Y-%m-%d') AS expiryDate,
              m.qty, m.refType, m.refId, m.note
       FROM pharmacy_stock_movements m
       LEFT JOIN drug_batches b ON b.id = m.batchId
       WHERE m.drugId = ? AND m.movementDate >= ? AND m.movementDate <= ?
       ORDER BY m.movementDate ASC, m.id ASC
       LIMIT ?`,
      [drugId, from, to, ctx.limit],
    );
    return {
      columns: [
        { key: 'movementDate', label: 'Date', type: 'date' },
        { key: 'kind', label: 'Kind' },
        { key: 'batchNo', label: 'Batch' },
        { key: 'expiryDate', label: 'Expiry', type: 'date' },
        { key: 'qty', label: 'Qty', type: 'number' },
        { key: 'refType', label: 'Ref type' },
        { key: 'refId', label: 'Ref id' },
        { key: 'note', label: 'Note' },
      ],
      rows,
      meta: { drugId, from, to },
    };
  },
};

const supplierOutstanding: ReportDef = {
  key: 'supplier-outstanding',
  name: 'Supplier outstanding',
  category: 'Pharmacy',
  description: 'Payable per supplier with last payment date.',
  roles: PHARMACY_ROLES,
  params: [],
  async run(_params, ctx): Promise<ReportResult> {
    const rows = await ctx.ds.query(
      `SELECT s.code, s.name, s.phone, s.outstandingPayable,
              DATE_FORMAT(
                (SELECT MAX(sp.paidAt) FROM supplier_payments sp WHERE sp.supplierId = s.id),
                '%Y-%m-%d') AS lastPaymentDate,
              COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp WHERE sp.supplierId = s.id), 0) AS totalPaid
       FROM suppliers s
       WHERE s.deletedAt IS NULL
       ORDER BY s.outstandingPayable DESC
       LIMIT ?`,
      [ctx.limit],
    );
    return {
      columns: [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Supplier' },
        { key: 'phone', label: 'Phone' },
        { key: 'totalPaid', label: 'Total paid', type: 'money' },
        { key: 'lastPaymentDate', label: 'Last payment', type: 'date' },
        { key: 'outstandingPayable', label: 'Outstanding', type: 'money' },
      ],
      rows,
    };
  },
};

// ---------------------------------------------------------------------------
// Statutory payroll (Phase 8) — all read `payslip_statutory`, never recompute.
// ---------------------------------------------------------------------------

const FY_RE = /^\d{4}-\d{4}$/;
function reqFy(params: Record<string, string>, key = 'financialYear'): string {
  const v = need(params, key);
  if (!FY_RE.test(v)) {
    throw new BadRequestException(`${key} must be YYYY-YYYY (e.g. 2025-2026)`);
  }
  return v;
}

/** The three "YYYY-MM" months of a quarter within an Apr–Mar financial year. */
function quarterMonths(financialYear: string, quarter: string): string[] {
  const startYear = Number(financialYear.split('-')[0]);
  const map: Record<string, [number, number]> = {
    Q1: [startYear, 4],
    Q2: [startYear, 7],
    Q3: [startYear, 10],
    Q4: [startYear + 1, 1],
  };
  const entry = map[quarter.toUpperCase()];
  if (!entry) throw new BadRequestException('quarter must be Q1, Q2, Q3 or Q4');
  const [year, firstMonth] = entry;
  return [0, 1, 2].map((o) => {
    const m = firstMonth + o;
    const yy = m > 12 ? year + 1 : year;
    const mm = ((m - 1) % 12) + 1;
    return `${yy}-${String(mm).padStart(2, '0')}`;
  });
}

const pfEcr: ReportDef = {
  key: 'pf-ecr',
  name: 'PF ECR (challan cum return)',
  category: 'Payroll',
  description: 'EPFO Electronic Challan cum Return lines for a month.',
  roles: HR_READ_ROLES,
  params: [{ key: 'periodMonth', label: 'Month', type: 'month', required: true }],
  async run(params, ctx): Promise<ReportResult> {
    const periodMonth = reqMonth(params, 'periodMonth');
    const rows = await ctx.ds.query(
      `SELECT COALESCE(esp.uanNumber, e.uanNumber, '') AS uan,
              e.code AS employeeCode,
              CONCAT(e.firstName,' ',e.lastName) AS memberName,
              ps.pfWages AS grossWages,
              ps.pfWages AS epfWages,
              LEAST(ps.pfWages, 15000) AS epsWages,
              LEAST(ps.pfWages, 15000) AS edliWages,
              ps.epfEmployee AS eeShare,
              ps.epsEmployer AS epsContribution,
              ps.epfEmployer AS erShareDiff,
              ps.ncpDays,
              0 AS refund
       FROM payslip_statutory ps
       JOIN employees e ON e.id = ps.employeeId
       LEFT JOIN employee_statutory_profiles esp ON esp.employeeId = ps.employeeId
       WHERE ps.periodMonth = ? AND ps.epfEmployee > 0
       ORDER BY e.code
       LIMIT ?`,
      [periodMonth, ctx.limit],
    );
    return {
      columns: [
        { key: 'uan', label: 'UAN' },
        { key: 'employeeCode', label: 'Emp code' },
        { key: 'memberName', label: 'Member name' },
        { key: 'grossWages', label: 'Gross wages', type: 'money' },
        { key: 'epfWages', label: 'EPF wages', type: 'money' },
        { key: 'epsWages', label: 'EPS wages', type: 'money' },
        { key: 'edliWages', label: 'EDLI wages', type: 'money' },
        { key: 'eeShare', label: 'EE share', type: 'money' },
        { key: 'epsContribution', label: 'EPS contribution', type: 'money' },
        { key: 'erShareDiff', label: 'ER share (diff)', type: 'money' },
        { key: 'ncpDays', label: 'NCP days', type: 'number' },
        { key: 'refund', label: 'Refund', type: 'money' },
      ],
      rows,
      meta: { periodMonth, members: rows.length },
    };
  },
};

const esiContribution: ReportDef = {
  key: 'esi-contribution',
  name: 'ESI contribution statement',
  category: 'Payroll',
  description: 'ESIC monthly contribution per insured person.',
  roles: HR_READ_ROLES,
  params: [{ key: 'periodMonth', label: 'Month', type: 'month', required: true }],
  async run(params, ctx): Promise<ReportResult> {
    const periodMonth = reqMonth(params, 'periodMonth');
    const rows = await ctx.ds.query(
      `SELECT COALESCE(esp.esiIpNumber, e.esiNumber, '') AS ipNumber,
              e.code AS employeeCode,
              CONCAT(e.firstName,' ',e.lastName) AS name,
              p.paidDays AS daysWorked,
              ps.esiWages AS totalWages,
              ps.esiEmployee AS eeContribution,
              ps.esiEmployer AS erContribution
       FROM payslip_statutory ps
       JOIN payslips p ON p.id = ps.payslipId
       JOIN employees e ON e.id = ps.employeeId
       LEFT JOIN employee_statutory_profiles esp ON esp.employeeId = ps.employeeId
       WHERE ps.periodMonth = ? AND ps.esiApplicable = 1
       ORDER BY e.code
       LIMIT ?`,
      [periodMonth, ctx.limit],
    );
    return {
      columns: [
        { key: 'ipNumber', label: 'IP number' },
        { key: 'employeeCode', label: 'Emp code' },
        { key: 'name', label: 'Name' },
        { key: 'daysWorked', label: 'Days', type: 'number' },
        { key: 'totalWages', label: 'Total wages', type: 'money' },
        { key: 'eeContribution', label: 'EE contribution', type: 'money' },
        { key: 'erContribution', label: 'ER contribution', type: 'money' },
      ],
      rows,
      meta: { periodMonth, insuredPersons: rows.length },
    };
  },
};

const ptChallan: ReportDef = {
  key: 'pt-challan',
  name: 'Professional tax challan (by state)',
  category: 'Payroll',
  description: 'Professional tax collected per state for a month.',
  roles: HR_READ_ROLES,
  params: [{ key: 'periodMonth', label: 'Month', type: 'month', required: true }],
  async run(params, ctx): Promise<ReportResult> {
    const periodMonth = reqMonth(params, 'periodMonth');
    const rows = await ctx.ds.query(
      `SELECT COALESCE(ps.ptStateCode, 'NA') AS stateCode,
              COUNT(*) AS employees,
              COALESCE(SUM(ps.ptAmount), 0) AS totalPt
       FROM payslip_statutory ps
       WHERE ps.periodMonth = ? AND ps.ptAmount > 0
       GROUP BY ps.ptStateCode
       ORDER BY totalPt DESC`,
      [periodMonth],
    );
    return {
      columns: [
        { key: 'stateCode', label: 'State' },
        { key: 'employees', label: 'Employees', type: 'number' },
        { key: 'totalPt', label: 'Total PT', type: 'money' },
      ],
      rows,
      meta: { periodMonth },
    };
  },
};

const form24q: ReportDef = {
  key: 'form-24q',
  name: 'Form 24Q (quarterly TDS)',
  category: 'Payroll',
  description: 'Deductee-wise salary TDS for a quarter of a financial year.',
  roles: HR_READ_ROLES,
  params: [
    { key: 'financialYear', label: 'Financial year (YYYY-YYYY)', type: 'text', required: true },
    {
      key: 'quarter',
      label: 'Quarter',
      type: 'select',
      required: true,
      options: [
        { value: 'Q1', label: 'Q1 (Apr–Jun)' },
        { value: 'Q2', label: 'Q2 (Jul–Sep)' },
        { value: 'Q3', label: 'Q3 (Oct–Dec)' },
        { value: 'Q4', label: 'Q4 (Jan–Mar)' },
      ],
    },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const fy = reqFy(params);
    const quarter = need(params, 'quarter');
    const months = quarterMonths(fy, quarter);
    const rows: Array<Record<string, string>> = await ctx.ds.query(
      `SELECT e.code AS employeeCode,
              COALESCE(e.panNumber, '') AS pan,
              CONCAT(e.firstName,' ',e.lastName) AS name,
              COALESCE(SUM(p.grossEarnings), 0) AS amountPaid,
              COALESCE(SUM(p.tdsAmount), 0) AS taxDeducted,
              COALESCE(SUM(p.tdsAmount), 0) AS taxDeposited
       FROM payslips p
       JOIN employees e ON e.id = p.employeeId
       WHERE p.periodMonth IN (?, ?, ?)
       GROUP BY e.id
       HAVING amountPaid > 0
       ORDER BY e.code
       LIMIT ?`,
      [...months, ctx.limit],
    );
    const noPan = rows.filter((r) => !r.pan).map((r) => r.employeeCode);
    return {
      columns: [
        { key: 'employeeCode', label: 'Emp code' },
        { key: 'pan', label: 'PAN' },
        { key: 'name', label: 'Deductee' },
        { key: 'amountPaid', label: 'Amount paid/credited', type: 'money' },
        { key: 'taxDeducted', label: 'Tax deducted', type: 'money' },
        { key: 'taxDeposited', label: 'Tax deposited', type: 'money' },
      ],
      rows,
      meta: { financialYear: fy, quarter, months, noPanCount: noPan.length, noPan },
    };
  },
};

const taxComputation: ReportDef = {
  key: 'tax-computation',
  name: 'Tax computation sheet',
  category: 'Payroll',
  description: 'Projected annual tax + TDS position for one employee.',
  roles: HR_READ_ROLES,
  params: [
    { key: 'employeeId', label: 'Employee id', type: 'number', required: true },
    { key: 'financialYear', label: 'Financial year (YYYY-YYYY)', type: 'text', required: true },
  ],
  async run(params, ctx): Promise<ReportResult> {
    const employeeId = need(params, 'employeeId');
    const fy = reqFy(params);
    const startYear = Number(fy.split('-')[0]);
    const fyStart = `${startYear}-04`;
    const fyEnd = `${startYear + 1}-03`;

    const [proj] = await ctx.ds.query(
      `SELECT ps.taxRegime, ps.projectedAnnualGross, ps.projectedTaxableIncome,
              ps.projectedAnnualTax, ps.tdsThisMonth, ps.tdsYtd, ps.periodMonth
       FROM payslip_statutory ps
       WHERE ps.employeeId = ? AND ps.financialYear = ?
       ORDER BY ps.periodMonth DESC
       LIMIT 1`,
      [employeeId, fy],
    );
    const [actual] = await ctx.ds.query(
      `SELECT COALESCE(SUM(p.grossEarnings), 0) AS grossPaid,
              COALESCE(SUM(p.tdsAmount), 0) AS tdsPaid,
              COUNT(*) AS months
       FROM payslips p
       WHERE p.employeeId = ? AND p.periodMonth >= ? AND p.periodMonth <= ?`,
      [employeeId, fyStart, fyEnd],
    );
    const [emp] = await ctx.ds.query(
      `SELECT e.code, CONCAT(e.firstName,' ',e.lastName) AS name,
              COALESCE(e.panNumber,'') AS pan
       FROM employees e WHERE e.id = ?`,
      [employeeId],
    );
    const [decl] = await ctx.ds.query(
      `SELECT regime, deduction80C, deduction80D, deduction80CCD1B,
              hraRentPaid, homeLoanInterest, metroCity, status
       FROM tax_declarations WHERE employeeId = ? AND financialYear = ?`,
      [employeeId, fy],
    );

    if (!proj) {
      return {
        columns: [
          { key: 'label', label: 'Item' },
          { key: 'value', label: 'Value' },
        ],
        rows: [],
        meta: {
          financialYear: fy,
          employeeId,
          note: 'No processed payslip for this employee in this FY yet.',
        },
      };
    }

    const balance =
      Number(proj.projectedAnnualTax) - Number(actual?.tdsPaid ?? 0);
    const rows: Array<Record<string, string>> = [
      { label: 'Employee', value: `${emp?.name ?? ''} (${emp?.code ?? ''})` },
      { label: 'PAN', value: emp?.pan || '—' },
      { label: 'Tax regime', value: proj.taxRegime },
      { label: 'Declaration status', value: decl?.status ?? 'NONE' },
      { label: 'Declared 80C', value: decl?.deduction80C ?? '0.00' },
      { label: 'Declared 80D', value: decl?.deduction80D ?? '0.00' },
      { label: 'Declared 80CCD(1B)', value: decl?.deduction80CCD1B ?? '0.00' },
      { label: 'Declared HRA rent paid', value: decl?.hraRentPaid ?? '0.00' },
      { label: 'Declared home-loan interest', value: decl?.homeLoanInterest ?? '0.00' },
      { label: 'Projected annual gross', value: proj.projectedAnnualGross },
      { label: 'Projected taxable income', value: proj.projectedTaxableIncome },
      { label: 'Projected annual tax', value: proj.projectedAnnualTax },
      { label: 'Gross paid so far', value: actual?.grossPaid ?? '0.00' },
      { label: 'TDS deducted so far', value: actual?.tdsPaid ?? '0.00' },
      { label: 'Months processed', value: String(actual?.months ?? 0) },
      { label: 'Balance tax to recover', value: balance.toFixed(2) },
      { label: 'Current month TDS', value: proj.tdsThisMonth },
    ];
    return {
      columns: [
        { key: 'label', label: 'Item' },
        { key: 'value', label: 'Value' },
      ],
      rows,
      meta: { financialYear: fy, employeeId, asOf: proj.periodMonth },
    };
  },
};

const statutoryCostSummary: ReportDef = {
  key: 'statutory-cost-summary',
  name: 'Statutory cost summary',
  category: 'Payroll',
  description: 'Employer + employee statutory totals for a month.',
  roles: HR_READ_ROLES,
  params: [{ key: 'periodMonth', label: 'Month', type: 'month', required: true }],
  async run(params, ctx): Promise<ReportResult> {
    const periodMonth = reqMonth(params, 'periodMonth');
    const [t] = await ctx.ds.query(
      `SELECT COUNT(*) AS employees,
              COALESCE(SUM(ps.epfEmployee), 0) AS epfEmployee,
              COALESCE(SUM(ps.epfEmployer), 0) AS epfEmployer,
              COALESCE(SUM(ps.epsEmployer), 0) AS epsEmployer,
              COALESCE(SUM(ps.edliEmployer), 0) AS edliEmployer,
              COALESCE(SUM(ps.pfAdminEmployer), 0) AS pfAdminEmployer,
              COALESCE(SUM(ps.esiEmployee), 0) AS esiEmployee,
              COALESCE(SUM(ps.esiEmployer), 0) AS esiEmployer,
              COALESCE(SUM(ps.ptAmount), 0) AS pt,
              COALESCE(SUM(ps.tdsThisMonth), 0) AS tds
       FROM payslip_statutory ps
       WHERE ps.periodMonth = ?`,
      [periodMonth],
    );
    const employerTotal =
      Number(t?.epfEmployer ?? 0) +
      Number(t?.epsEmployer ?? 0) +
      Number(t?.edliEmployer ?? 0) +
      Number(t?.pfAdminEmployer ?? 0) +
      Number(t?.esiEmployer ?? 0);
    const employeeTotal =
      Number(t?.epfEmployee ?? 0) +
      Number(t?.esiEmployee ?? 0) +
      Number(t?.pt ?? 0) +
      Number(t?.tds ?? 0);
    const rows = [
      { head: 'Employee deductions', item: 'EPF (employee)', amount: t?.epfEmployee ?? '0.00' },
      { head: 'Employee deductions', item: 'ESI (employee)', amount: t?.esiEmployee ?? '0.00' },
      { head: 'Employee deductions', item: 'Professional tax', amount: t?.pt ?? '0.00' },
      { head: 'Employee deductions', item: 'TDS', amount: t?.tds ?? '0.00' },
      { head: 'Employee deductions', item: 'Total employee', amount: employeeTotal.toFixed(2) },
      { head: 'Employer contributions', item: 'EPF (employer)', amount: t?.epfEmployer ?? '0.00' },
      { head: 'Employer contributions', item: 'EPS (employer)', amount: t?.epsEmployer ?? '0.00' },
      { head: 'Employer contributions', item: 'EDLI', amount: t?.edliEmployer ?? '0.00' },
      { head: 'Employer contributions', item: 'PF admin', amount: t?.pfAdminEmployer ?? '0.00' },
      { head: 'Employer contributions', item: 'ESI (employer)', amount: t?.esiEmployer ?? '0.00' },
      { head: 'Employer contributions', item: 'Total employer', amount: employerTotal.toFixed(2) },
    ];
    return {
      columns: [
        { key: 'head', label: 'Section' },
        { key: 'item', label: 'Item' },
        { key: 'amount', label: 'Amount', type: 'money' },
      ],
      rows,
      meta: { periodMonth, employees: Number(t?.employees ?? 0) },
    };
  },
};

export const REPORT_DEFS: ReportDef[] = [
  payrollRegister,
  bankTransfer,
  componentSummary,
  attendanceRegister,
  leaveBalance,
  employeeMaster,
  joinersExits,
  paymentRegister,
  dailyCollection,
  customerAgeing,
  customerStatement,
  customerMaster,
  doctorMaster,
  mrCallReport,
  mrTourCompliance,
  mrPobSummary,
  mrSampleAccount,
  patientRegister,
  appointmentRegister,
  doctorProductivity,
  patientOutstandingAgeing,
  clinicRevenue,
  prescriptionsIssued,
  pharmacyStock,
  expiryReport,
  dispenseRegister,
  purchaseRegister,
  drugMovement,
  supplierOutstanding,
  pfEcr,
  esiContribution,
  ptChallan,
  form24q,
  taxComputation,
  statutoryCostSummary,
];
