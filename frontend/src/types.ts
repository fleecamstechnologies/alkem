export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  FINANCE: 'FINANCE',
  SALES_MANAGER: 'SALES_MANAGER',
  DATA_ENTRY: 'DATA_ENTRY',
  HR_ADMIN: 'HR_ADMIN',
  HR_MANAGER: 'HR_MANAGER',
  EMPLOYEE: 'EMPLOYEE',
  RECEPTION: 'RECEPTION',
  CLINICIAN: 'CLINICIAN',
  PHARMACIST: 'PHARMACIST',
  VIEWER: 'VIEWER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const WRITE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.FINANCE,
  UserRole.SALES_MANAGER,
  UserRole.DATA_ENTRY,
];

export const HR_MANAGE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.HR_ADMIN,
  UserRole.HR_MANAGER,
];

export const HR_WRITE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.HR_ADMIN,
];

export const HR_READ_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.HR_ADMIN,
  UserRole.HR_MANAGER,
  UserRole.FINANCE,
];

export const CLINIC_READ_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.RECEPTION,
  UserRole.CLINICIAN,
];
export const CLINIC_DESK_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.RECEPTION,
];
export const CLINIC_WRITE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.CLINICIAN,
];

export const PHARMACY_READ_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.PHARMACIST,
  UserRole.RECEPTION,
  UserRole.CLINICIAN,
];
export const PHARMACY_WRITE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.PHARMACIST,
];

export const CustomerType = {
  CHEMIST: 'CHEMIST',
  STOCKIST: 'STOCKIST',
  HOSPITAL: 'HOSPITAL',
  DOCTOR: 'DOCTOR',
  INSTITUTION: 'INSTITUTION',
  INDIVIDUAL: 'INDIVIDUAL',
} as const;
export type CustomerType = (typeof CustomerType)[keyof typeof CustomerType];

export const CustomerStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BLOCKED: 'BLOCKED',
} as const;
export type CustomerStatus = (typeof CustomerStatus)[keyof typeof CustomerStatus];

export const PaymentKind = {
  INVOICE: 'INVOICE',
  RECEIPT: 'RECEIPT',
  CREDIT_NOTE: 'CREDIT_NOTE',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;
export type PaymentKind = (typeof PaymentKind)[keyof typeof PaymentKind];

export const PaymentMethod = {
  CASH: 'CASH',
  CHEQUE: 'CHEQUE',
  NEFT: 'NEFT',
  RTGS: 'RTGS',
  UPI: 'UPI',
  CARD: 'CARD',
  OTHER: 'OTHER',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentStatus = {
  PENDING: 'PENDING',
  CLEARED: 'CLEARED',
  BOUNCED: 'BOUNCED',
  CANCELLED: 'CANCELLED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: string | null;
  employeeId: string | null;
  doctorId: string | null;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  type: CustomerType;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  territory: string | null;
  assignedRepId: string | null;
  creditLimit: string;
  outstandingBalance: string;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  customerId: string;
  kind: PaymentKind;
  amount: string;
  method: PaymentMethod | null;
  referenceNo: string | null;
  paymentDate: string;
  status: PaymentStatus;
  notes: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  rows: T[];
  nextCursor: string | null;
  total: number | null;
  limit: number;
}

export interface StatementLine extends Payment {
  runningBalance: string;
}

export interface Statement {
  customerId: string;
  customerName: string;
  from: string;
  to: string;
  openingBalance: string;
  closingBalance: string;
  currentBalance: string;
  lines: StatementLine[];
}

export interface PeriodSummaryRow {
  bucket: string;
  invoiced: string;
  received: string;
  creditNotes: string;
  count: number;
}

export interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  blockedCustomers: number;
  totalOutstanding: string;
  invoicedThisMonth: string;
  receivedThisMonth: string;
  paymentsToday: number;
  topOutstanding: Array<
    Pick<Customer, 'id' | 'code' | 'name' | 'city' | 'outstandingBalance'>
  >;
}

export interface ImportJob {
  id: string;
  entity:
    | 'customers'
    | 'payments'
    | 'employees'
    | 'attendance'
    | 'patients'
    | 'drugs'
    | 'doctors';
  status: 'running' | 'completed' | 'failed';
  fileName: string;
  total: number;
  processed: number;
  inserted: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; reason: string }>;
  startedAt: string;
  finishedAt: string | null;
  message: string | null;
}

// ---- Phase 2: HR ----------------------------------------------------

export const EmploymentType = {
  FULL_TIME: 'FULL_TIME',
  PART_TIME: 'PART_TIME',
  CONTRACT: 'CONTRACT',
  INTERN: 'INTERN',
} as const;
export type EmploymentType =
  (typeof EmploymentType)[keyof typeof EmploymentType];

export const EmployeeStatus = {
  ACTIVE: 'ACTIVE',
  ON_LEAVE: 'ON_LEAVE',
  SUSPENDED: 'SUSPENDED',
  TERMINATED: 'TERMINATED',
} as const;
export type EmployeeStatus =
  (typeof EmployeeStatus)[keyof typeof EmployeeStatus];

export const AttendanceStatus = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  ON_LEAVE: 'ON_LEAVE',
  HALF_DAY: 'HALF_DAY',
  HOLIDAY: 'HOLIDAY',
  WEEK_OFF: 'WEEK_OFF',
} as const;
export type AttendanceStatus =
  (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export const LeaveRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;
export type LeaveRequestStatus =
  (typeof LeaveRequestStatus)[keyof typeof LeaveRequestStatus];

export const ComponentType = {
  EARNING: 'EARNING',
  DEDUCTION: 'DEDUCTION',
  EMPLOYER_CONTRIBUTION: 'EMPLOYER_CONTRIBUTION',
} as const;
export type ComponentType = (typeof ComponentType)[keyof typeof ComponentType];

export const TaxRegime = { OLD: 'OLD', NEW: 'NEW' } as const;
export type TaxRegime = (typeof TaxRegime)[keyof typeof TaxRegime];

export const DeclarationStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  LOCKED: 'LOCKED',
} as const;
export type DeclarationStatus =
  (typeof DeclarationStatus)[keyof typeof DeclarationStatus];

export const CalculationType = {
  FIXED: 'FIXED',
  PERCENT_OF_BASIC: 'PERCENT_OF_BASIC',
} as const;
export type CalculationType =
  (typeof CalculationType)[keyof typeof CalculationType];

export const PayRunStatus = {
  DRAFT: 'DRAFT',
  PROCESSED: 'PROCESSED',
  APPROVED: 'APPROVED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
} as const;
export type PayRunStatus = (typeof PayRunStatus)[keyof typeof PayRunStatus];

export interface Department {
  id: string;
  name: string;
  code: string | null;
  headEmployeeId: string | null;
}

export interface Employee {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  departmentId: string | null;
  designation: string | null;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  dateOfJoining: string;
  dateOfLeaving: string | null;
  reportingManagerId: string | null;
  workLocation: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  bankIfsc: string | null;
  panNumber: string | null;
  aadhaarNumber: string | null;
  pfNumber: string | null;
  uanNumber: string | null;
  esiNumber: string | null;
  ctcAnnual: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  leaveTypeId: string | null;
  workedHours: string | null;
  source: string;
  note: string | null;
  firstInAt?: string | null;
  lastOutAt?: string | null;
  breakMinutes?: number;
}

export interface MonthGridDay {
  date: string;
  status: AttendanceStatus;
  leaveTypeId: string | null;
  note: string | null;
  recorded: boolean;
}

// ---- Phase 9: geofenced punch in/out ------------------------------

export const PunchType = {
  PUNCH_IN: 'PUNCH_IN',
  PUNCH_OUT: 'PUNCH_OUT',
  BREAK_START: 'BREAK_START',
  BREAK_END: 'BREAK_END',
} as const;
export type PunchType = (typeof PunchType)[keyof typeof PunchType];

export interface OfficeLocation {
  id: string;
  code: string;
  name: string;
  latitude: string;
  longitude: string;
  radiusMeters: number;
  address: string | null;
  isActive: boolean;
}

export interface AttendanceSettings {
  id: string;
  punchHalfDayHours: string;
  punchFullDayHours: string;
  defaultGeofenceMeters: number;
}

export interface PunchEvent {
  id: string;
  type: PunchType;
  eventAt: string;
  officeName: string | null;
  distanceM: number | null;
  withinGeofence: boolean;
  source: string;
}

export interface PunchStatus {
  date: string;
  state: 'OUT' | 'IN' | 'ON_BREAK';
  since: string | null;
  office: { id: string; name: string; distanceM: number } | null;
  firstInAt: string | null;
  lastOutAt: string | null;
  breakMinutes: number;
  workedMinutes: number;
  status: AttendanceStatus | null;
  events: PunchEvent[];
}

export interface Regularization {
  id: string;
  employeeId: string;
  date: string;
  requestedInAt: string | null;
  requestedOutAt: string | null;
  reason: string;
  status: LeaveRequestStatus;
  decidedByUserId: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  employeeName?: string | null;
  employeeCode?: string | null;
}

export interface PunchEventRow {
  id: string;
  employeeId: string;
  eventDate: string;
  eventAt: string;
  type: PunchType;
  officeId: string | null;
  distanceM: number | null;
  withinGeofence: boolean;
  source: string;
  note: string | null;
}

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  paid: boolean;
  annualQuota: string;
  active: boolean;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  entitled: string;
  used: string;
  pending: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  days: string;
  halfDay: boolean;
  reason: string | null;
  status: LeaveRequestStatus;
  decidedByUserId: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  employeeName?: string | null;
  employeeCode?: string | null;
}

export interface SalaryComponent {
  id: string;
  code: string;
  name: string;
  type: ComponentType;
  calculationType: CalculationType;
  defaultValue: string;
  taxable: boolean;
  active: boolean;
  system: boolean;
}

export interface SalaryStructureLine {
  id: string;
  structureId: string;
  componentId: string;
  calculationType: CalculationType;
  value: string;
  computedMonthly: string;
  component?: SalaryComponent | null;
}

export interface SalaryStructure {
  id: string;
  employeeId: string;
  effectiveFrom: string;
  basicMonthly: string;
  grossMonthly: string;
  active: boolean;
  note: string | null;
  lines: SalaryStructureLine[];
}

export interface PayRun {
  id: string;
  periodMonth: string;
  status: PayRunStatus;
  runDate: string | null;
  totalGross: string;
  totalDeductions: string;
  totalNet: string;
  employeeCount: number;
  processedByUserId: string | null;
  approvedByUserId: string | null;
  createdAt: string;
}

export interface PayslipLine {
  id: string;
  payslipId: string;
  componentCode: string;
  componentName: string;
  type: ComponentType;
  amount: string;
}

export interface Payslip {
  id: string;
  payRunId: string;
  employeeId: string;
  periodMonth: string;
  totalDaysInMonth: number;
  paidDays: string;
  lopDays: string;
  basic: string;
  grossEarnings: string;
  totalDeductions: string;
  netPay: string;
  employerContributions: string;
  ctcMonthly: string;
  tdsAmount: string;
  status: 'GENERATED' | 'PAID';
  createdAt: string;
  employeeName?: string | null;
  employeeCode?: string | null;
}

export interface PayslipStatutory {
  id: string;
  payslipId: string;
  employeeId: string;
  periodMonth: string;
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
  ptStateCode: string | null;
  ptAmount: string;
  taxRegime: TaxRegime;
  projectedAnnualGross: string;
  projectedTaxableIncome: string;
  projectedAnnualTax: string;
  tdsThisMonth: string;
  tdsYtd: string;
}

export interface PayslipDetail extends Payslip {
  lines: PayslipLine[];
  statutory: PayslipStatutory | null;
  employee: Employee | null;
}

export interface StatutoryConfig {
  id: string;
  financialYear: string;
  effectiveFrom: string;
  pfWageCeiling: string;
  pfEmployeeRate: string;
  pfEmployerRate: string;
  epsRate: string;
  epsWageCeiling: string;
  edliRate: string;
  pfAdminRate: string;
  pfCapAtCeilingDefault: boolean;
  esiWageCeiling: string;
  esiEmployeeRate: string;
  esiEmployerRate: string;
  stdDeductionOld: string;
  stdDeductionNew: string;
  cessRate: string;
  rebate87aOldLimit: string;
  rebate87aNewLimit: string;
  active: boolean;
}

export interface PtSlab {
  id: string;
  stateCode: string;
  stateName: string;
  effectiveFrom: string;
  minGross: string;
  maxGross: string | null;
  monthlyAmount: string;
  februaryAmount: string | null;
  active: boolean;
}

export interface ItSlab {
  id: string;
  regime: TaxRegime;
  financialYear: string;
  effectiveFrom: string;
  minAnnual: string;
  maxAnnual: string | null;
  ratePercent: string;
}

export interface EmployeeStatutoryProfile {
  id: string;
  employeeId: string;
  pfApplicable: boolean;
  pfUsesActualWage: boolean;
  esiApplicable: boolean | null;
  ptStateCode: string;
  uanNumber: string | null;
  pfAccountNumber: string | null;
  esiIpNumber: string | null;
}

export interface TaxDeclaration {
  id: string;
  employeeId: string;
  financialYear: string;
  regime: TaxRegime;
  deduction80C: string;
  deduction80D: string;
  deduction80CCD1B: string;
  hraRentPaid: string;
  homeLoanInterest: string;
  otherExemptAllowances: string;
  otherChapterVIA: string;
  metroCity: boolean;
  status: DeclarationStatus;
  submittedAt: string | null;
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

export interface TaxDeclarationView {
  declaration: TaxDeclaration;
  projection: AnnualTaxResult | null;
  regimeComparison: {
    old: AnnualTaxResult | null;
    new: AnnualTaxResult | null;
  };
}

export interface PayrollDashboard {
  periodMonth: string;
  currentRun: {
    id: string;
    status: PayRunStatus;
    totalNet: string;
    employeeCount: number;
  } | null;
  headcount: number;
  costByDepartment: Array<{
    department: string;
    employees: number;
    net: string;
  }>;
}

export interface AttendanceSummary {
  periodMonth: string;
  byStatus: Array<{ status: string; count: number }>;
  onLeaveToday: number;
}

// ---- Phase 3: Reports --------------------------------------------------

export type ReportParamType =
  | 'date'
  | 'month'
  | 'text'
  | 'number'
  | 'select'
  | 'payRun';

export interface ReportParamDef {
  key: string;
  label: string;
  type: ReportParamType;
  required?: boolean;
  default?: string;
  options?: { value: string; label: string }[];
}

export interface ReportColumn {
  key: string;
  label: string;
  type?: 'money' | 'number' | 'date' | 'text';
}

export interface ReportInfo {
  key: string;
  name: string;
  category: 'Payroll' | 'HR' | 'Finance' | 'CRM';
  description?: string;
  params: ReportParamDef[];
}

export interface ReportResult {
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  meta?: Record<string, unknown>;
}

// ---- Phase 5: Field force -------------------------------------------

export const PromoItemType = {
  SAMPLE: 'SAMPLE',
  GIFT: 'GIFT',
  PRODUCT: 'PRODUCT',
} as const;
export type PromoItemType =
  (typeof PromoItemType)[keyof typeof PromoItemType];

export const CallKind = { DOCTOR: 'DOCTOR', CHEMIST: 'CHEMIST' } as const;
export type CallKind = (typeof CallKind)[keyof typeof CallKind];

export const CallProductAction = {
  DETAILED: 'DETAILED',
  SAMPLE: 'SAMPLE',
  GIFT: 'GIFT',
  ORDER: 'ORDER',
} as const;
export type CallProductAction =
  (typeof CallProductAction)[keyof typeof CallProductAction];

export const TourPlanStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type TourPlanStatus =
  (typeof TourPlanStatus)[keyof typeof TourPlanStatus];

export interface FieldRepRow {
  id: string;
  employeeId: string;
  hq: string | null;
  territory: string | null;
  active: boolean | number;
  employeeCode: string;
  employeeName: string;
  doctors: number;
  chemists: number;
}

export interface PromoItem {
  id: string;
  code: string;
  name: string;
  type: PromoItemType;
  unit: string;
  active: boolean;
}

export interface RepStockRow {
  promoItemId: string;
  code: string;
  name: string;
  type: string;
  unit: string;
  balance: string;
}

export interface StockMovementRow {
  id: string;
  promoItemId: string;
  itemCode: string;
  itemName: string;
  kind: string;
  qty: string;
  movementDate: string;
  refType: string | null;
  refId: string | null;
  note: string | null;
}

export interface TourPlanDay {
  id: string;
  tourPlanId: string;
  planDate: string;
  area: string;
  plannedCalls: number;
  notes: string | null;
}

export interface TourPlanRow {
  id: string;
  repEmployeeId: string;
  periodMonth: string;
  status: TourPlanStatus;
  submittedAt: string | null;
  decidedAt: string | null;
  note: string | null;
  repCode: string;
  repName: string;
  dayCount: number;
  plannedCalls: number;
}

export interface TourPlan {
  id: string;
  repEmployeeId: string;
  periodMonth: string;
  status: TourPlanStatus;
  note: string | null;
  days: TourPlanDay[];
}

export interface CallReportRow {
  id: string;
  repEmployeeId: string;
  callDate: string;
  kind: CallKind;
  wasPlanned: boolean | number;
  pobValue: string;
  area: string | null;
  remarks: string | null;
  repCode: string;
  partyName: string | null;
  partyCode: string | null;
  sampleLines: number;
}

export interface FieldDashboardRow {
  repEmployeeId: string;
  repCode: string;
  repName: string;
  planned: number;
  actual: number;
  compliancePct: number | null;
  workingDays: number;
  callAverage: number;
  doctorsMet: number;
  chemistsMet: number;
  doctorsAssigned: number;
  coveragePct: number | null;
  pobValue: string;
}

export interface FieldDashboard {
  periodMonth: string;
  workingDays?: number;
  rows: FieldDashboardRow[];
  totals: { planned: number; actual: number; pobValue: string } | null;
}

// ---- Phase 6: Patients & clinical -------------------------------------

export const Gender = { MALE: 'MALE', FEMALE: 'FEMALE', OTHER: 'OTHER' } as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const PatientStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  DECEASED: 'DECEASED',
} as const;
export type PatientStatus =
  (typeof PatientStatus)[keyof typeof PatientStatus];

export const AppointmentStatus = {
  SCHEDULED: 'SCHEDULED',
  CONFIRMED: 'CONFIRMED',
  CHECKED_IN: 'CHECKED_IN',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type AppointmentStatus =
  (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const AppointmentType = {
  NEW: 'NEW',
  FOLLOW_UP: 'FOLLOW_UP',
  PROCEDURE: 'PROCEDURE',
  TELE: 'TELE',
} as const;
export type AppointmentType =
  (typeof AppointmentType)[keyof typeof AppointmentType];

export const ChargeKind = {
  INVOICE: 'INVOICE',
  PAYMENT: 'PAYMENT',
  REFUND: 'REFUND',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;
export type ChargeKind = (typeof ChargeKind)[keyof typeof ChargeKind];

export const ChargeMethod = {
  CASH: 'CASH',
  CARD: 'CARD',
  UPI: 'UPI',
  NEFT: 'NEFT',
  INSURANCE: 'INSURANCE',
  OTHER: 'OTHER',
} as const;
export type ChargeMethod = (typeof ChargeMethod)[keyof typeof ChargeMethod];

export const ServiceKind = {
  CONSULTATION: 'CONSULTATION',
  PROCEDURE: 'PROCEDURE',
  LAB: 'LAB',
  PHARMACY: 'PHARMACY',
  REGISTRATION: 'REGISTRATION',
  OTHER: 'OTHER',
} as const;
export type ServiceKind = (typeof ServiceKind)[keyof typeof ServiceKind];

export const LabFlag = {
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  LOW: 'LOW',
  CRITICAL: 'CRITICAL',
} as const;
export type LabFlag = (typeof LabFlag)[keyof typeof LabFlag];

export interface Patient {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  gender: Gender | null;
  dateOfBirth: string | null;
  phone: string | null;
  altPhone: string | null;
  email: string | null;
  bloodGroup: string | null;
  maritalStatus: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  assignedDoctorId: string | null;
  registrationDate: string;
  status: PatientStatus;
  allergies: string | null;
  chronicConditions: string | null;
  outstandingBalance: string;
  visitCount: number;
  lastVisitAt: string | null;
  createdAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  durationMin: number;
  status: AppointmentStatus;
  type: AppointmentType;
  reason: string | null;
  department: string | null;
  visitId: string | null;
  cancelReason: string | null;
  createdAt: string;
  patientName?: string | null;
  patientCode?: string | null;
  doctorName?: string | null;
  doctorCode?: string | null;
}

export interface Visit {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId: string | null;
  visitDate: string;
  visitType: string;
  chiefComplaint: string | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  pulse: number | null;
  temperature: string | null;
  weightKg: string | null;
  heightCm: string | null;
  spo2: number | null;
  bmi: string | null;
  diagnosis: string | null;
  icdCodes: string | null;
  clinicalNotes: string | null;
  followUpDate: string | null;
  createdAt: string;
}

export interface PrescriptionItem {
  drugName: string;
  strength: string | null;
  dosage: string | null;
  route: string | null;
  frequency: string | null;
  durationDays: number | null;
  quantity: string | null;
  instructions: string | null;
}

export interface LabTest {
  id: string;
  patientId: string;
  visitId: string | null;
  testName: string;
  orderedAt: string;
  status: string;
  resultValue: string | null;
  unit: string | null;
  refRange: string | null;
  flag: LabFlag | null;
  resultAt: string | null;
  notes: string | null;
}

export interface VisitDetail extends Visit {
  prescriptions: Array<{
    id: string;
    prescribedAt: string;
    notes: string | null;
    items: PrescriptionItem[];
  }>;
  labs: LabTest[];
}

export interface PatientCharge {
  id: string;
  patientId: string;
  kind: ChargeKind;
  amount: string;
  method: ChargeMethod | null;
  reference: string | null;
  chargeDate: string;
  serviceKind: ServiceKind | null;
  description: string | null;
  visitId: string | null;
  status: 'PENDING' | 'CLEARED' | 'CANCELLED';
  createdAt: string;
}

export interface PatientStatement {
  patientId: string;
  patientName: string;
  from: string;
  to: string;
  openingBalance: string;
  closingBalance: string;
  currentBalance: string;
  lines: Array<PatientCharge & { runningBalance: string }>;
}

export interface MedicalHistory {
  patient: Patient;
  allergies: string | null;
  chronicConditions: string | null;
  visits: Array<{
    id: string;
    visitDate: string;
    visitType: string;
    chiefComplaint: string | null;
    diagnosis: string | null;
    followUpDate: string | null;
    doctorName: string | null;
  }>;
  recentMedicines: Array<{
    drugName: string;
    strength: string | null;
    dosage: string | null;
    frequency: string | null;
    durationDays: number | null;
    prescribedAt: string;
  }>;
  recentLabs: Array<{
    testName: string;
    status: string;
    resultValue: string | null;
    unit: string | null;
    refRange: string | null;
    flag: string | null;
    orderedAt: string;
  }>;
}

export interface ClinicBillingDashboard {
  date: string;
  todayCollected: string;
  totalOutstanding: string;
  revenueByService: Array<{ serviceKind: string; total: string }>;
}

export interface ApptDashboard {
  date: string;
  byStatus: Array<{ status: string; count: number }>;
  total: number;
}

// ---- Phase 7: Pharmacy & inventory ----------------------------------

export const DrugForm = {
  TABLET: 'TABLET',
  CAPSULE: 'CAPSULE',
  SYRUP: 'SYRUP',
  INJECTION: 'INJECTION',
  OINTMENT: 'OINTMENT',
  DROPS: 'DROPS',
  CONSUMABLE: 'CONSUMABLE',
  OTHER: 'OTHER',
} as const;
export type DrugForm = (typeof DrugForm)[keyof typeof DrugForm];

export const GrnStatus = {
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  CANCELLED: 'CANCELLED',
} as const;
export type GrnStatus = (typeof GrnStatus)[keyof typeof GrnStatus];

export const DispenseStatus = {
  DISPENSED: 'DISPENSED',
  CANCELLED: 'CANCELLED',
} as const;
export type DispenseStatus =
  (typeof DispenseStatus)[keyof typeof DispenseStatus];

export interface Drug {
  id: string;
  code: string;
  name: string;
  genericName: string | null;
  form: DrugForm;
  strength: string | null;
  unit: string;
  hsnCode: string | null;
  gstRate: string;
  mrp: string;
  purchasePrice: string;
  reorderLevel: number;
  rackLocation: string | null;
  scheduleH: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DrugStockRow {
  id: string;
  code: string;
  name: string;
  genericName: string | null;
  form: DrugForm;
  strength: string | null;
  unit: string;
  mrp: string;
  purchasePrice: string;
  reorderLevel: number;
  rackLocation: string | null;
  isActive: boolean | number;
  onHand: string;
  batchCount: string | number;
  stockValue: string;
  lowStock: boolean | number;
}

export interface DrugBatch {
  id: string;
  drugId: string;
  batchNo: string;
  expiryDate: string;
  mrp: string;
  purchasePrice: string;
  quantityReceived: string;
  quantityOnHand: string;
  grnId: string | null;
  supplierId: string | null;
  receivedDate: string;
  createdAt: string;
}

export interface DrugMovementRow {
  id: string;
  batchId: string;
  batchNo: string | null;
  expiryDate: string | null;
  kind: string;
  qty: string;
  movementDate: string;
  refType: string | null;
  refId: string | null;
  note: string | null;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  outstandingPayable: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  amount: string;
  method: string | null;
  reference: string | null;
  paidAt: string;
  notes: string | null;
  createdAt: string;
}

export interface GrnItem {
  id: string;
  grnId: string;
  drugId: string;
  drugCode?: string;
  drugName?: string;
  batchNo: string;
  expiryDate: string;
  quantity: string;
  freeQuantity: string;
  purchasePrice: string;
  mrp: string;
  gstRate: string;
  lineTotal: string;
}

export interface Grn {
  id: string;
  grnNo: string;
  supplierId: string;
  supplierName?: string | null;
  invoiceNo: string | null;
  invoiceDate: string | null;
  receivedDate: string;
  status: GrnStatus;
  subtotal: string;
  gstAmount: string;
  total: string;
  notes: string | null;
  createdAt: string;
  items?: GrnItem[];
}

export interface DispenseItem {
  id: string;
  dispenseId: string;
  drugId: string;
  drugCode?: string;
  drugName?: string;
  batchId: string;
  batchNo?: string | null;
  expiryDate?: string | null;
  prescriptionItemId: string | null;
  quantity: string;
  mrp: string;
  gstRate: string;
  discount: string;
  lineTotal: string;
}

export interface Dispense {
  id: string;
  dispenseNo: string;
  patientId: string;
  patientName?: string | null;
  prescriptionId: string | null;
  visitId: string | null;
  status: DispenseStatus;
  subtotal: string;
  discount: string;
  gstAmount: string;
  total: string;
  patientChargeId: string | null;
  dispensedAt: string;
  createdAt: string;
  items?: DispenseItem[];
}

export interface PrescriptionPrefill {
  prescriptionId: string;
  patientId: string;
  items: Array<{
    prescriptionItemId: string;
    drugName: string;
    strength: string | null;
    dosage: string | null;
    quantity: string | null;
    matchedDrugId: string | null;
    matchedDrugName: string | null;
    matchedMrp: string | null;
  }>;
}

export interface PharmacyDashboard {
  date: string;
  lowStockCount: number;
  expiringSoonCount: number;
  dispenseTodayValue: string;
  dispenseTodayCount: number;
  grnTodayValue: string;
  grnTodayCount: number;
  totalStockValue: string;
}

export interface PharmacyAlerts {
  lowStock: Array<{
    id: string;
    code: string;
    name: string;
    reorderLevel: number;
    rackLocation: string | null;
    onHand: string;
  }>;
  expiring: Array<{
    batchId: string;
    drugId: string;
    code: string;
    name: string;
    batchNo: string;
    expiryDate: string;
    quantityOnHand: string;
    valueAtRisk: string;
  }>;
}
