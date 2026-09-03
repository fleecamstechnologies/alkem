export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum PatientStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DECEASED = 'DECEASED',
}

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum AppointmentType {
  NEW = 'NEW',
  FOLLOW_UP = 'FOLLOW_UP',
  PROCEDURE = 'PROCEDURE',
  TELE = 'TELE',
}

export enum VisitType {
  OPD = 'OPD',
  IPD = 'IPD',
  EMERGENCY = 'EMERGENCY',
  TELE = 'TELE',
}

export enum LabStatus {
  ORDERED = 'ORDERED',
  COLLECTED = 'COLLECTED',
  RESULT_READY = 'RESULT_READY',
  CANCELLED = 'CANCELLED',
}

export enum LabFlag {
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  LOW = 'LOW',
  CRITICAL = 'CRITICAL',
}

export enum ChargeKind {
  INVOICE = 'INVOICE',
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum ChargeMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  UPI = 'UPI',
  NEFT = 'NEFT',
  INSURANCE = 'INSURANCE',
  OTHER = 'OTHER',
}

export enum ServiceKind {
  CONSULTATION = 'CONSULTATION',
  PROCEDURE = 'PROCEDURE',
  LAB = 'LAB',
  PHARMACY = 'PHARMACY',
  REGISTRATION = 'REGISTRATION',
  OTHER = 'OTHER',
}

export enum ChargeStatus {
  PENDING = 'PENDING',
  CLEARED = 'CLEARED',
  CANCELLED = 'CANCELLED',
}

/** Charge statuses whose amount affects the patient's outstanding balance. */
export const BALANCE_AFFECTING_CHARGE_STATUSES: ChargeStatus[] = [
  ChargeStatus.PENDING,
  ChargeStatus.CLEARED,
];

/** Sign a charge kind applies to the outstanding balance. */
export function chargeSign(kind: ChargeKind): 1 | -1 {
  return kind === ChargeKind.INVOICE || kind === ChargeKind.ADJUSTMENT ? 1 : -1;
}
