import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Headline record counts for every major table, grouped by area. Exact
 * `COUNT(*)` run in parallel and cached for 5 min — the big tables (patients,
 * visits) are index-counted by MySQL in well under a second.
 */
const GROUPS: { group: string; items: { key: string; label: string; table: string }[] }[] = [
  {
    group: 'CRM & Finance',
    items: [
      { key: 'customers', label: 'Customers', table: 'customers' },
      { key: 'payments', label: 'Payment entries', table: 'payments' },
    ],
  },
  {
    group: 'HR & Payroll',
    items: [
      { key: 'employees', label: 'Employees', table: 'employees' },
      { key: 'departments', label: 'Departments', table: 'departments' },
      { key: 'attendanceRecords', label: 'Attendance records', table: 'attendance_records' },
      { key: 'attendanceEvents', label: 'Punch events', table: 'attendance_events' },
      { key: 'leaveRequests', label: 'Leave requests', table: 'leave_requests' },
      { key: 'payRuns', label: 'Pay runs', table: 'pay_runs' },
      { key: 'payslips', label: 'Payslips', table: 'payslips' },
      { key: 'offices', label: 'Office locations', table: 'office_locations' },
    ],
  },
  {
    group: 'Clinical',
    items: [
      { key: 'patients', label: 'Patients', table: 'patients' },
      { key: 'doctors', label: 'Doctors', table: 'doctors' },
      { key: 'appointments', label: 'Appointments', table: 'appointments' },
      { key: 'visits', label: 'Visits (history)', table: 'visits' },
      { key: 'prescriptions', label: 'Prescriptions', table: 'prescriptions' },
      { key: 'labTests', label: 'Lab tests', table: 'lab_tests' },
      { key: 'patientCharges', label: 'Patient charges', table: 'patient_charges' },
    ],
  },
  {
    group: 'Pharmacy',
    items: [
      { key: 'drugs', label: 'Drugs', table: 'drugs' },
      { key: 'suppliers', label: 'Suppliers', table: 'suppliers' },
      { key: 'drugBatches', label: 'Drug batches', table: 'drug_batches' },
      { key: 'grns', label: 'GRNs', table: 'grns' },
      { key: 'dispenses', label: 'Dispenses', table: 'dispenses' },
    ],
  },
  {
    group: 'Field force',
    items: [
      { key: 'fieldReps', label: 'Field reps', table: 'field_reps' },
      { key: 'callReports', label: 'Call reports', table: 'call_reports' },
      { key: 'promoItems', label: 'Promo items', table: 'promo_items' },
      { key: 'tourPlans', label: 'Tour plans', table: 'tour_plans' },
    ],
  },
  {
    group: 'System',
    items: [
      { key: 'users', label: 'Users', table: 'users' },
      { key: 'auditLogs', label: 'Audit log entries', table: 'audit_logs' },
    ],
  },
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

/** Extra status-filtered counts, keyed the same way as `counts`. */
const EXTRA: { key: string; sql: string }[] = [
  { key: 'patientsActive', sql: `SELECT COUNT(*) AS c FROM \`patients\` WHERE status = 'ACTIVE'` },
  { key: 'patientsInactive', sql: `SELECT COUNT(*) AS c FROM \`patients\` WHERE status = 'INACTIVE'` },
];

/** Featured tiles shown as a strip at the top of the dashboard section. */
const HIGHLIGHTS: { key: string; label: string }[] = [
  { key: 'patientsActive', label: 'Active patients' },
  { key: 'patientsInactive', label: 'Inactive patients' },
  { key: 'employees', label: 'Total employees' },
  { key: 'doctors', label: 'Total doctors' },
];

export interface RecordCounts {
  counts: Record<string, number>;
  highlights: { key: string; label: string }[];
  groups: { group: string; items: { key: string; label: string }[] }[];
  generatedAt: string;
}

@Injectable()
export class StatsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async counts(): Promise<RecordCounts> {
    const key = 'stats:counts';
    const cached = await this.cache.get<RecordCounts>(key);
    if (cached) return cached;

    const run = async (k: string, sql: string) => {
      try {
        const rows = await this.dataSource.query(sql);
        return [k, Number(rows?.[0]?.c ?? 0)] as const;
      } catch {
        return [k, -1] as const; // table/column missing on this env
      }
    };

    const results = await Promise.all([
      ...ALL_ITEMS.map(({ key: k, table }) =>
        run(k, `SELECT COUNT(*) AS c FROM \`${table}\``),
      ),
      ...EXTRA.map(({ key: k, sql }) => run(k, sql)),
    ]);

    const payload: RecordCounts = {
      counts: Object.fromEntries(results),
      highlights: HIGHLIGHTS,
      groups: GROUPS.map((g) => ({
        group: g.group,
        items: g.items.map(({ key: k, label }) => ({ key: k, label })),
      })),
      generatedAt: new Date().toISOString(),
    };
    await this.cache.set(key, payload, 300_000);
    return payload;
  }
}
