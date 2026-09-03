export enum UserRole {
  /** Full access to every module and to user administration. */
  SUPER_ADMIN = 'SUPER_ADMIN',
  /** Finance team: payments, statements, customer balances, payroll cost. */
  FINANCE = 'FINANCE',
  /** Sales management: customer & doctor master, territories, assignments. */
  SALES_MANAGER = 'SALES_MANAGER',
  /** Back-office data entry: create/edit customers and payments, run imports. */
  DATA_ENTRY = 'DATA_ENTRY',
  /** HR administrator: employees, salary structures, pay runs, leave config. */
  HR_ADMIN = 'HR_ADMIN',
  /** HR manager: approve leave/attendance, initiate pay runs, read HR data. */
  HR_MANAGER = 'HR_MANAGER',
  /** Self-service only: an employee login, scoped to /me/* routes. */
  EMPLOYEE = 'EMPLOYEE',
  /** Clinic front desk: register patients, schedule appointments, take payments. */
  RECEPTION = 'RECEPTION',
  /** Doctor / nurse login: visits, prescriptions, labs, read patient history. */
  CLINICIAN = 'CLINICIAN',
  /** Pharmacy: drug master, goods receipt, dispensing, stock. */
  PHARMACIST = 'PHARMACIST',
  /** Read-only access to customers, payments and dashboards. */
  VIEWER = 'VIEWER',
}

/** Roles allowed to mutate customer / payment / doctor data. */
export const WRITE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.FINANCE,
  UserRole.SALES_MANAGER,
  UserRole.DATA_ENTRY,
];

/** Every role can read customer-side data. */
export const READ_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.FINANCE,
  UserRole.SALES_MANAGER,
  UserRole.DATA_ENTRY,
  UserRole.HR_ADMIN,
  UserRole.HR_MANAGER,
  UserRole.VIEWER,
];

/** Configure HR masters (employees, components, leave types). */
export const HR_WRITE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.HR_ADMIN,
];

/** Operate HR workflows (approve leave, process/approve pay runs). */
export const HR_MANAGE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.HR_ADMIN,
  UserRole.HR_MANAGER,
];

/** Read HR data (adds FINANCE for payroll cost visibility). */
export const HR_READ_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.HR_ADMIN,
  UserRole.HR_MANAGER,
  UserRole.FINANCE,
];

/** Read patient / clinical data. */
export const CLINIC_READ_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.RECEPTION,
  UserRole.CLINICIAN,
];

/** Front-desk writes: patient master, scheduling, billing. */
export const CLINIC_DESK_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.RECEPTION,
];

/** Clinical writes: visits, prescriptions, labs. */
export const CLINIC_WRITE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.CLINICIAN,
];

/** Read pharmacy data (adds front-desk + doctors for stock lookups). */
export const PHARMACY_READ_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.PHARMACIST,
  UserRole.RECEPTION,
  UserRole.CLINICIAN,
];

/** Pharmacy writes: drug master, GRN, dispensing, adjustments. */
export const PHARMACY_WRITE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.PHARMACIST,
];
