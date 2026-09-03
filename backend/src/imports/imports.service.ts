import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import { unlink } from 'fs/promises';
import { Customer } from '../customers/entities/customer.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Employee } from '../employees/entities/employee.entity';
import { AttendanceRecord } from '../attendance/entities/attendance-record.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Drug } from '../pharmacy/entities/drug.entity';
import { CustomersService } from '../customers/customers.service';
import {
  ImportEntity,
  ImportJob,
  ImportJobRegistry,
} from './import-job.registry';
import { ImportOptions } from './dto/import-options.dto';
import { readRows } from './row-source';
import { CustomerStatus, CustomerType } from '../common/enums/customer.enum';
import {
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
} from '../common/enums/payment.enum';
import {
  EmployeeStatus,
  EmploymentType,
} from '../common/enums/employee.enum';
import {
  AttendanceSource,
  AttendanceStatus,
} from '../common/enums/attendance.enum';
import { Gender, PatientStatus } from '../common/enums/patient.enum';
import { DrugForm } from '../common/enums/pharmacy.enum';

const CHUNK_SIZE = 1000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Common alternate column headers -> canonical field. Keys are normalised
 * (lower-case, alphanumerics only). An alias is only used when its target field
 * is valid for the entity being imported.
 */
const HEADER_ALIASES: Record<string, string> = {
  // identity / codes
  employeecode: 'code',
  empcode: 'code',
  staffcode: 'code',
  employeeno: 'code',
  empno: 'code',
  customercode: 'code',
  patientcode: 'code',
  uhid: 'code',
  drugcode: 'code',
  itemcode: 'code',
  // names
  fname: 'firstName',
  givenname: 'firstName',
  lname: 'lastName',
  surname: 'lastName',
  fullname: 'name',
  companyname: 'name',
  customername: 'name',
  drugname: 'name',
  medicinename: 'name',
  // contact
  mobile: 'phone',
  mobileno: 'phone',
  mobilenumber: 'phone',
  phoneno: 'phone',
  phonenumber: 'phone',
  contact: 'phone',
  contactno: 'phone',
  contactnumber: 'phone',
  emailid: 'email',
  mailid: 'email',
  emailaddress: 'email',
  // HR
  doj: 'dateOfJoining',
  joiningdate: 'dateOfJoining',
  dateofjoin: 'dateOfJoining',
  dateofjoining: 'dateOfJoining',
  dob: 'dateOfBirth',
  birthdate: 'dateOfBirth',
  dateofbirth: 'dateOfBirth',
  ctc: 'ctcAnnual',
  annualctc: 'ctcAnnual',
  ctcannual: 'ctcAnnual',
  ctcperannum: 'ctcAnnual',
  department: 'departmentId',
  dept: 'departmentId',
  deptid: 'departmentId',
  designationtitle: 'designation',
  jobtitle: 'designation',
  emptype: 'employmentType',
  typeofemployment: 'employmentType',
  location: 'workLocation',
  branch: 'workLocation',
  worklocationbranch: 'workLocation',
  // statutory / bank
  pan: 'panNumber',
  panno: 'panNumber',
  pancard: 'panNumber',
  aadhaar: 'aadhaarNumber',
  aadhar: 'aadhaarNumber',
  aadharno: 'aadhaarNumber',
  aadhaarno: 'aadhaarNumber',
  uan: 'uanNumber',
  uanno: 'uanNumber',
  pf: 'pfNumber',
  pfno: 'pfNumber',
  pfnumber: 'pfNumber',
  esi: 'esiNumber',
  esic: 'esiNumber',
  esino: 'esiNumber',
  esinumber: 'esiNumber',
  ifsc: 'bankIfsc',
  ifsccode: 'bankIfsc',
  accountnumber: 'bankAccountNumber',
  accountno: 'bankAccountNumber',
  accno: 'bankAccountNumber',
  bankaccountno: 'bankAccountNumber',
  accountname: 'bankAccountName',
  accountholder: 'bankAccountName',
  accountholdername: 'bankAccountName',
  bank: 'bankName',
  // address
  address: 'addressLine1',
  addressline: 'addressLine1',
  address1: 'addressLine1',
  address2: 'addressLine2',
  pin: 'pincode',
  pincode: 'pincode',
  zipcode: 'pincode',
  postalcode: 'pincode',
  // payments
  paymentdate: 'paymentDate',
  txndate: 'paymentDate',
  amt: 'amount',
  refno: 'referenceNo',
  referenceno: 'referenceNo',
  reference: 'referenceNo',
  // pharmacy
  mrp: 'mrp',
  purchaserate: 'purchasePrice',
  purchaseprice: 'purchasePrice',
  gst: 'gstRate',
  gstrate: 'gstRate',
  reorderlevel: 'reorderLevel',
  hsn: 'hsnCode',
  hsncode: 'hsnCode',
};

type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

interface ChunkConfig {
  target: EntityTarget<ObjectLiteral>;
  updateCols: string[];
  conflictCols: string[];
}

const CUSTOMER_FIELDS = [
  'code', 'name', 'type', 'phone', 'email', 'gstin', 'addressLine1',
  'addressLine2', 'city', 'state', 'pincode', 'territory', 'assignedRepId',
  'creditLimit', 'status',
] as const;

const PAYMENT_FIELDS = [
  'customerId', 'customerCode', 'kind', 'amount', 'method', 'referenceNo',
  'paymentDate', 'status', 'notes',
] as const;

const EMPLOYEE_FIELDS = [
  'code', 'firstName', 'lastName', 'email', 'phone', 'designation',
  'employmentType', 'status', 'dateOfJoining', 'dateOfBirth', 'departmentId',
  'workLocation', 'bankAccountName', 'bankAccountNumber', 'bankName', 'bankIfsc',
  'panNumber', 'aadhaarNumber', 'pfNumber', 'uanNumber', 'esiNumber', 'ctcAnnual',
] as const;

const ATTENDANCE_FIELDS = [
  'employeeId', 'employeeCode', 'date', 'status', 'workedHours', 'note',
] as const;

const PATIENT_FIELDS = [
  'code', 'firstName', 'lastName', 'gender', 'dateOfBirth', 'phone', 'altPhone',
  'email', 'bloodGroup', 'maritalStatus', 'addressLine1', 'addressLine2',
  'city', 'state', 'pincode', 'emergencyName', 'emergencyPhone',
  'assignedDoctorId', 'registrationDate', 'status', 'allergies',
  'chronicConditions',
] as const;

const DRUG_FIELDS = [
  'code', 'name', 'genericName', 'form', 'strength', 'unit', 'hsnCode',
  'gstRate', 'mrp', 'purchasePrice', 'reorderLevel', 'rackLocation',
  'scheduleH', 'isActive',
] as const;

const CHUNK_CONFIG: Record<ImportEntity, ChunkConfig> = {
  customers: {
    target: Customer,
    updateCols: [...CUSTOMER_FIELDS].filter((c) => c !== 'code'),
    conflictCols: ['code'],
  },
  payments: {
    target: Payment,
    updateCols: ['kind', 'amount', 'method', 'paymentDate', 'status', 'notes'],
    conflictCols: ['customerId', 'referenceNo'],
  },
  employees: {
    target: Employee,
    updateCols: [...EMPLOYEE_FIELDS].filter((c) => c !== 'code'),
    conflictCols: ['code'],
  },
  attendance: {
    target: AttendanceRecord,
    updateCols: ['status', 'workedHours', 'note', 'source'],
    conflictCols: ['employeeId', 'date'],
  },
  patients: {
    target: Patient,
    updateCols: [...PATIENT_FIELDS].filter((c) => c !== 'code'),
    conflictCols: ['code'],
  },
  drugs: {
    target: Drug,
    updateCols: [...DRUG_FIELDS].filter((c) => c !== 'code'),
    conflictCols: ['code'],
  },
};

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly registry: ImportJobRegistry,
    private readonly customersService: CustomersService,
  ) {}

  start(
    entity: ImportEntity,
    filePath: string,
    originalName: string,
    mapping: Record<string, string>,
    options: ImportOptions,
  ): ImportJob {
    const job = this.registry.create(entity, originalName);
    void this.run(job, filePath, originalName, mapping, options).catch((err) => {
      this.logger.error(`Import ${job.id} crashed`, err as Error);
      this.registry.finish(job, 'failed', (err as Error).message);
    });
    return job;
  }

  private async run(
    job: ImportJob,
    filePath: string,
    originalName: string,
    mapping: Record<string, string>,
    options: ImportOptions,
  ): Promise<void> {
    try {
      if (job.entity === 'customers') {
        await this.importCustomers(job, filePath, originalName, mapping, options);
      } else if (job.entity === 'payments') {
        await this.importPayments(job, filePath, originalName, mapping, options);
      } else if (job.entity === 'employees') {
        await this.importEmployees(job, filePath, originalName, mapping, options);
      } else if (job.entity === 'attendance') {
        await this.importAttendance(job, filePath, originalName, mapping, options);
      } else if (job.entity === 'drugs') {
        await this.importDrugs(job, filePath, originalName, mapping, options);
      } else {
        await this.importPatients(job, filePath, originalName, mapping, options);
      }
      this.registry.finish(job, 'completed');
    } finally {
      await unlink(filePath).catch(() => undefined);
    }
  }

  /**
   * Resolve a spreadsheet/CSV column header to a target field.
   * When an explicit `mapping` is supplied it wins. Otherwise headers are
   * matched loosely: lower-cased with every non-alphanumeric char removed, so
   * `Code`, `First Name`, `Date Of Joining`, `EMP CODE` etc. all line up — plus
   * a table of common alternate names.
   */
  private mapRecord(
    record: Record<string, string>,
    mapping: Record<string, string>,
    allowed: readonly string[],
  ): Record<string, string> {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const byNorm = new Map(allowed.map((f) => [norm(f), f]));
    const resolve = (header: string): string | undefined => {
      const n = norm(header);
      if (byNorm.has(n)) return byNorm.get(n);
      const alias = HEADER_ALIASES[n];
      return alias && allowed.includes(alias) ? alias : undefined;
    };

    const out: Record<string, string> = {};
    const hasMapping = Object.keys(mapping).length > 0;
    for (const [header, value] of Object.entries(record)) {
      const field = hasMapping
        ? (mapping[header] ?? resolve(header))
        : resolve(header);
      if (field && allowed.includes(field) && value !== '' && value != null) {
        out[field] = String(value).trim();
      }
    }
    return out;
  }

  // ---- customers ---------------------------------------------------

  private async importCustomers(
    job: ImportJob,
    filePath: string,
    originalName: string,
    mapping: Record<string, string>,
    options: ImportOptions,
  ): Promise<void> {
    let buffer: Partial<Customer>[] = [];
    const flush = async () => {
      if (buffer.length === 0) return;
      const rows = buffer;
      buffer = [];
      try {
        const r = await this.insertChunk('customers', rows, options.upsert);
        job.inserted += r.inserted;
        job.updated += r.updated;
      } catch {
        await this.insertRowByRow('customers', rows, options.upsert, job);
      }
    };

    for await (const { rowNumber, record } of readRows(filePath, originalName)) {
      job.total += 1;
      job.processed += 1;
      const mapped = this.mapRecord(record, mapping, CUSTOMER_FIELDS);
      const validation = this.validateCustomer(mapped);
      if (!validation.ok) {
        this.registry.addError(job, rowNumber, validation.error);
        continue;
      }
      buffer.push(validation.value);
      if (buffer.length >= CHUNK_SIZE) await flush();
    }
    await flush();
  }

  private validateCustomer(
    m: Record<string, string>,
  ): ValidationResult<Partial<Customer>> {
    if (Object.keys(m).length === 0) {
      return { ok: false, error: 'no recognised columns - check the header row matches the field names' };
    }
    if (!m.code) return { ok: false, error: 'missing "code" column' };
    if (!m.name) return { ok: false, error: 'missing name' };
    if (m.type && !(m.type in CustomerType)) {
      return { ok: false, error: `bad type "${m.type}"` };
    }
    if (m.status && !(m.status in CustomerStatus)) {
      return { ok: false, error: `bad status "${m.status}"` };
    }
    if (m.creditLimit && Number.isNaN(Number(m.creditLimit))) {
      return { ok: false, error: `bad creditLimit "${m.creditLimit}"` };
    }
    return {
      ok: true,
      value: {
        code: m.code.slice(0, 40),
        name: m.name.slice(0, 200),
        type: (m.type as CustomerType) ?? CustomerType.CHEMIST,
        phone: m.phone ?? null,
        email: m.email ?? null,
        gstin: m.gstin ?? null,
        addressLine1: m.addressLine1 ?? null,
        addressLine2: m.addressLine2 ?? null,
        city: m.city ?? null,
        state: m.state ?? null,
        pincode: m.pincode ?? null,
        territory: m.territory ?? null,
        assignedRepId: m.assignedRepId ?? null,
        creditLimit: m.creditLimit ?? '0',
        status: (m.status as CustomerStatus) ?? CustomerStatus.ACTIVE,
      },
    };
  }

  // ---- payments -------------------------------------------------

  private async importPayments(
    job: ImportJob,
    filePath: string,
    originalName: string,
    mapping: Record<string, string>,
    options: ImportOptions,
  ): Promise<void> {
    const codeCache = new Map<string, string | null>();
    const affected = new Set<string>();
    let buffer: Array<{ row: Partial<Payment>; rowNumber: number }> = [];

    const resolveCustomerId = async (
      m: Record<string, string>,
    ): Promise<string | null> => {
      if (m.customerId) return m.customerId;
      if (!m.customerCode) return null;
      if (codeCache.has(m.customerCode)) return codeCache.get(m.customerCode)!;
      const found = await this.dataSource
        .getRepository(Customer)
        .findOne({ where: { code: m.customerCode }, select: ['id'] });
      const id = found?.id ?? null;
      codeCache.set(m.customerCode, id);
      return id;
    };

    const flush = async () => {
      if (buffer.length === 0) return;
      const rows = buffer.map((b) => b.row);
      const batch = buffer;
      buffer = [];
      try {
        const r = await this.insertChunk('payments', rows, options.upsert);
        job.inserted += r.inserted;
        job.updated += r.updated;
      } catch {
        await this.insertRowByRow(
          'payments',
          rows,
          options.upsert,
          job,
          batch.map((b) => b.rowNumber),
        );
      }
    };

    for await (const { rowNumber, record } of readRows(filePath, originalName)) {
      job.total += 1;
      job.processed += 1;
      const mapped = this.mapRecord(record, mapping, PAYMENT_FIELDS);
      const customerId = await resolveCustomerId(mapped);
      if (!customerId) {
        this.registry.addError(
          job,
          rowNumber,
          `unknown customer (${mapped.customerCode ?? mapped.customerId ?? 'n/a'})`,
        );
        continue;
      }
      const validation = this.validatePayment(mapped, customerId);
      if (!validation.ok) {
        this.registry.addError(job, rowNumber, validation.error);
        continue;
      }
      affected.add(customerId);
      buffer.push({ row: validation.value, rowNumber });
      if (buffer.length >= CHUNK_SIZE) await flush();
    }
    await flush();

    job.message = 'recomputing customer balances…';
    await this.customersService.recomputeOutstandingForIds([...affected]);
    job.message = null;
  }

  private validatePayment(
    m: Record<string, string>,
    customerId: string,
  ): ValidationResult<Partial<Payment>> {
    if (!m.kind || !(m.kind in PaymentKind)) {
      return { ok: false, error: `bad kind "${m.kind ?? ''}"` };
    }
    if (!m.amount || Number.isNaN(Number(m.amount))) {
      return { ok: false, error: `bad amount "${m.amount ?? ''}"` };
    }
    if (!m.paymentDate || !DATE.test(m.paymentDate)) {
      return {
        ok: false,
        error: `paymentDate must be YYYY-MM-DD (got "${m.paymentDate ?? ''}")`,
      };
    }
    if (m.method && !(m.method in PaymentMethod)) {
      return { ok: false, error: `bad method "${m.method}"` };
    }
    if (m.status && !(m.status in PaymentStatus)) {
      return { ok: false, error: `bad status "${m.status}"` };
    }
    return {
      ok: true,
      value: {
        customerId,
        kind: m.kind as PaymentKind,
        amount: m.amount,
        method: (m.method as PaymentMethod) ?? null,
        referenceNo: m.referenceNo ?? null,
        paymentDate: m.paymentDate,
        status: (m.status as PaymentStatus) ?? PaymentStatus.CLEARED,
        notes: m.notes ?? null,
      },
    };
  }

  // ---- employees ------------------------------------------------

  private async importEmployees(
    job: ImportJob,
    filePath: string,
    originalName: string,
    mapping: Record<string, string>,
    options: ImportOptions,
  ): Promise<void> {
    let buffer: Partial<Employee>[] = [];
    const flush = async () => {
      if (buffer.length === 0) return;
      const rows = buffer;
      buffer = [];
      try {
        const r = await this.insertChunk('employees', rows, options.upsert);
        job.inserted += r.inserted;
        job.updated += r.updated;
      } catch {
        await this.insertRowByRow('employees', rows, options.upsert, job);
      }
    };

    for await (const { rowNumber, record } of readRows(filePath, originalName)) {
      job.total += 1;
      job.processed += 1;
      const mapped = this.mapRecord(record, mapping, EMPLOYEE_FIELDS);
      const validation = this.validateEmployee(mapped);
      if (!validation.ok) {
        this.registry.addError(job, rowNumber, validation.error);
        continue;
      }
      buffer.push(validation.value);
      if (buffer.length >= CHUNK_SIZE) await flush();
    }
    await flush();
  }

  private validateEmployee(
    m: Record<string, string>,
  ): ValidationResult<Partial<Employee>> {
    if (Object.keys(m).length === 0) {
      return { ok: false, error: 'no recognised columns - check the header row matches the field names' };
    }
    if (!m.code) return { ok: false, error: 'missing "code" column' };
    if (!m.firstName || !m.lastName) {
      return { ok: false, error: 'missing firstName / lastName' };
    }
    if (!m.dateOfJoining || !DATE.test(m.dateOfJoining)) {
      return { ok: false, error: 'dateOfJoining must be YYYY-MM-DD' };
    }
    if (m.employmentType && !(m.employmentType in EmploymentType)) {
      return { ok: false, error: `bad employmentType "${m.employmentType}"` };
    }
    if (m.status && !(m.status in EmployeeStatus)) {
      return { ok: false, error: `bad status "${m.status}"` };
    }
    if (m.dateOfBirth && !DATE.test(m.dateOfBirth)) {
      return { ok: false, error: 'dateOfBirth must be YYYY-MM-DD' };
    }
    return {
      ok: true,
      value: {
        code: m.code.slice(0, 40),
        firstName: m.firstName.slice(0, 100),
        lastName: m.lastName.slice(0, 100),
        email: m.email ?? null,
        phone: m.phone ?? null,
        designation: m.designation ?? null,
        employmentType:
          (m.employmentType as EmploymentType) ?? EmploymentType.FULL_TIME,
        status: (m.status as EmployeeStatus) ?? EmployeeStatus.ACTIVE,
        dateOfJoining: m.dateOfJoining,
        dateOfBirth: m.dateOfBirth ?? null,
        departmentId: m.departmentId ? String(Number(m.departmentId)) : null,
        workLocation: m.workLocation ?? null,
        bankAccountName: m.bankAccountName ?? null,
        bankAccountNumber: m.bankAccountNumber ?? null,
        bankName: m.bankName ?? null,
        bankIfsc: m.bankIfsc ?? null,
        panNumber: m.panNumber ?? null,
        aadhaarNumber: m.aadhaarNumber ?? null,
        pfNumber: m.pfNumber ?? null,
        uanNumber: m.uanNumber ?? null,
        esiNumber: m.esiNumber ?? null,
        ctcAnnual: m.ctcAnnual ?? '0',
      },
    };
  }

  // ---- attendance --------------------------------------------

  private async importAttendance(
    job: ImportJob,
    filePath: string,
    originalName: string,
    mapping: Record<string, string>,
    options: ImportOptions,
  ): Promise<void> {
    const codeCache = new Map<string, string | null>();
    let buffer: Array<{ row: Partial<AttendanceRecord>; rowNumber: number }> = [];

    const resolveEmployeeId = async (
      m: Record<string, string>,
    ): Promise<string | null> => {
      if (m.employeeId) return String(Number(m.employeeId));
      if (!m.employeeCode) return null;
      if (codeCache.has(m.employeeCode)) return codeCache.get(m.employeeCode)!;
      const found = await this.dataSource
        .getRepository(Employee)
        .findOne({ where: { code: m.employeeCode }, select: ['id'] });
      const id = found?.id ?? null;
      codeCache.set(m.employeeCode, id);
      return id;
    };

    const flush = async () => {
      if (buffer.length === 0) return;
      const rows = buffer.map((b) => b.row);
      const batch = buffer;
      buffer = [];
      try {
        const r = await this.insertChunk('attendance', rows, options.upsert);
        job.inserted += r.inserted;
        job.updated += r.updated;
      } catch {
        await this.insertRowByRow(
          'attendance',
          rows,
          options.upsert,
          job,
          batch.map((b) => b.rowNumber),
        );
      }
    };

    for await (const { rowNumber, record } of readRows(filePath, originalName)) {
      job.total += 1;
      job.processed += 1;
      const mapped = this.mapRecord(record, mapping, ATTENDANCE_FIELDS);
      const employeeId = await resolveEmployeeId(mapped);
      if (!employeeId) {
        this.registry.addError(
          job,
          rowNumber,
          `unknown employee (${mapped.employeeCode ?? mapped.employeeId ?? 'n/a'})`,
        );
        continue;
      }
      const validation = this.validateAttendance(mapped, employeeId);
      if (!validation.ok) {
        this.registry.addError(job, rowNumber, validation.error);
        continue;
      }
      buffer.push({ row: validation.value, rowNumber });
      if (buffer.length >= CHUNK_SIZE) await flush();
    }
    await flush();
  }

  private validateAttendance(
    m: Record<string, string>,
    employeeId: string,
  ): ValidationResult<Partial<AttendanceRecord>> {
    if (!m.date || !DATE.test(m.date)) {
      return { ok: false, error: `date must be YYYY-MM-DD (got "${m.date ?? ''}")` };
    }
    if (!m.status || !(m.status in AttendanceStatus)) {
      return { ok: false, error: `bad status "${m.status ?? ''}"` };
    }
    return {
      ok: true,
      value: {
        employeeId,
        date: m.date,
        status: m.status as AttendanceStatus,
        workedHours: m.workedHours ?? null,
        note: m.note ?? null,
        source: AttendanceSource.IMPORT,
      },
    };
  }

  // ---- patients -------------------------------------------------

  private async importPatients(
    job: ImportJob,
    filePath: string,
    originalName: string,
    mapping: Record<string, string>,
    options: ImportOptions,
  ): Promise<void> {
    let buffer: Partial<Patient>[] = [];
    const flush = async () => {
      if (buffer.length === 0) return;
      const rows = buffer;
      buffer = [];
      try {
        const r = await this.insertChunk('patients', rows, options.upsert);
        job.inserted += r.inserted;
        job.updated += r.updated;
      } catch {
        await this.insertRowByRow('patients', rows, options.upsert, job);
      }
    };

    for await (const { rowNumber, record } of readRows(filePath, originalName)) {
      job.total += 1;
      job.processed += 1;
      const mapped = this.mapRecord(record, mapping, PATIENT_FIELDS);
      const v = this.validatePatient(mapped);
      if (!v.ok) {
        this.registry.addError(job, rowNumber, v.error);
        continue;
      }
      buffer.push(v.value);
      if (buffer.length >= CHUNK_SIZE) await flush();
    }
    await flush();
  }

  private validatePatient(
    m: Record<string, string>,
  ): ValidationResult<Partial<Patient>> {
    if (Object.keys(m).length === 0) {
      return { ok: false, error: 'no recognised columns - check the header row matches the field names' };
    }
    if (!m.code) return { ok: false, error: 'missing "code" column' };
    if (!m.firstName || !m.lastName) {
      return { ok: false, error: 'missing firstName / lastName' };
    }
    if (m.gender && !(m.gender in Gender)) {
      return { ok: false, error: `bad gender "${m.gender}"` };
    }
    if (m.status && !(m.status in PatientStatus)) {
      return { ok: false, error: `bad status "${m.status}"` };
    }
    if (m.dateOfBirth && !DATE.test(m.dateOfBirth)) {
      return { ok: false, error: 'dateOfBirth must be YYYY-MM-DD' };
    }
    if (m.registrationDate && !DATE.test(m.registrationDate)) {
      return { ok: false, error: 'registrationDate must be YYYY-MM-DD' };
    }
    return {
      ok: true,
      value: {
        code: m.code.slice(0, 40),
        firstName: m.firstName.slice(0, 100),
        lastName: m.lastName.slice(0, 100),
        gender: (m.gender as Gender) ?? null,
        dateOfBirth: m.dateOfBirth ?? null,
        phone: m.phone ?? null,
        altPhone: m.altPhone ?? null,
        email: m.email ?? null,
        bloodGroup: m.bloodGroup ?? null,
        maritalStatus: m.maritalStatus ?? null,
        addressLine1: m.addressLine1 ?? null,
        addressLine2: m.addressLine2 ?? null,
        city: m.city ?? null,
        state: m.state ?? null,
        pincode: m.pincode ?? null,
        emergencyName: m.emergencyName ?? null,
        emergencyPhone: m.emergencyPhone ?? null,
        assignedDoctorId: m.assignedDoctorId
          ? String(Number(m.assignedDoctorId))
          : null,
        registrationDate:
          m.registrationDate ?? new Date().toISOString().slice(0, 10),
        status: (m.status as PatientStatus) ?? PatientStatus.ACTIVE,
        allergies: m.allergies ?? null,
        chronicConditions: m.chronicConditions ?? null,
      },
    };
  }

  // ---- drugs -------------------------------------------------

  private async importDrugs(
    job: ImportJob,
    filePath: string,
    originalName: string,
    mapping: Record<string, string>,
    options: ImportOptions,
  ): Promise<void> {
    let buffer: Partial<Drug>[] = [];
    const flush = async () => {
      if (buffer.length === 0) return;
      const rows = buffer;
      buffer = [];
      try {
        const r = await this.insertChunk('drugs', rows, options.upsert);
        job.inserted += r.inserted;
        job.updated += r.updated;
      } catch {
        await this.insertRowByRow('drugs', rows, options.upsert, job);
      }
    };

    for await (const { rowNumber, record } of readRows(filePath, originalName)) {
      job.total += 1;
      job.processed += 1;
      const mapped = this.mapRecord(record, mapping, DRUG_FIELDS);
      const v = this.validateDrug(mapped);
      if (!v.ok) {
        this.registry.addError(job, rowNumber, v.error);
        continue;
      }
      buffer.push(v.value);
      if (buffer.length >= CHUNK_SIZE) await flush();
    }
    await flush();
  }

  private validateDrug(
    m: Record<string, string>,
  ): ValidationResult<Partial<Drug>> {
    if (Object.keys(m).length === 0) {
      return { ok: false, error: 'no recognised columns - check the header row matches the field names' };
    }
    if (!m.code) return { ok: false, error: 'missing "code" column' };
    if (!m.name) return { ok: false, error: 'missing name' };
    if (m.form && !(m.form in DrugForm)) {
      return { ok: false, error: `bad form "${m.form}"` };
    }
    for (const num of ['gstRate', 'mrp', 'purchasePrice'] as const) {
      if (m[num] && Number.isNaN(Number(m[num]))) {
        return { ok: false, error: `bad ${num} "${m[num]}"` };
      }
    }
    if (m.reorderLevel && Number.isNaN(Number(m.reorderLevel))) {
      return { ok: false, error: `bad reorderLevel "${m.reorderLevel}"` };
    }
    const truthy = (s: string | undefined) =>
      s === '1' || s?.toLowerCase() === 'true' || s?.toLowerCase() === 'yes';
    return {
      ok: true,
      value: {
        code: m.code.slice(0, 40),
        name: m.name.slice(0, 200),
        genericName: m.genericName ?? null,
        form: (m.form as DrugForm) ?? DrugForm.TABLET,
        strength: m.strength ?? null,
        unit: m.unit ?? 'unit',
        hsnCode: m.hsnCode ?? null,
        gstRate: m.gstRate ?? '0',
        mrp: m.mrp ?? '0',
        purchasePrice: m.purchasePrice ?? '0',
        reorderLevel: m.reorderLevel ? Number(m.reorderLevel) : 0,
        rackLocation: m.rackLocation ?? null,
        scheduleH: truthy(m.scheduleH),
        isActive: m.isActive === undefined ? true : truthy(m.isActive),
      },
    };
  }

  // ---- shared insert helpers -----------------------------

  private async insertChunk(
    entity: ImportEntity,
    rows: ObjectLiteral[],
    upsert: boolean,
  ): Promise<{ inserted: number; updated: number }> {
    const cfg = CHUNK_CONFIG[entity];
    const qb = this.dataSource
      .createQueryBuilder()
      .insert()
      .into(cfg.target)
      .values(rows as never);

    if (upsert) qb.orUpdate(cfg.updateCols, cfg.conflictCols);
    else qb.orIgnore();

    const result = await qb.execute();
    const affected =
      (result.raw as { affectedRows?: number }).affectedRows ?? rows.length;
    const updated = Math.max(0, affected - rows.length);
    const inserted = rows.length - updated;
    return { inserted, updated };
  }

  private async insertRowByRow(
    entity: ImportEntity,
    rows: ObjectLiteral[],
    upsert: boolean,
    job: ImportJob,
    rowNumbers?: number[],
  ): Promise<void> {
    for (let i = 0; i < rows.length; i += 1) {
      try {
        const res = await this.insertChunk(entity, [rows[i]], upsert);
        job.inserted += res.inserted;
        job.updated += res.updated;
      } catch (err) {
        this.registry.addError(
          job,
          rowNumbers?.[i] ?? job.processed,
          (err as Error).message.slice(0, 200),
        );
      }
    }
  }
}
