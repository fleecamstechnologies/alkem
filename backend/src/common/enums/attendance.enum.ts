export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  ON_LEAVE = 'ON_LEAVE',
  HALF_DAY = 'HALF_DAY',
  HOLIDAY = 'HOLIDAY',
  WEEK_OFF = 'WEEK_OFF',
}

export enum AttendanceSource {
  MANUAL = 'MANUAL',
  IMPORT = 'IMPORT',
  LEAVE = 'LEAVE',
  SYSTEM = 'SYSTEM',
  /** Written by the self-service geofenced punch flow. */
  PUNCH = 'PUNCH',
  /** Written when a manager approves a regularization request. */
  REGULARIZED = 'REGULARIZED',
}

export enum PunchType {
  PUNCH_IN = 'PUNCH_IN',
  PUNCH_OUT = 'PUNCH_OUT',
  BREAK_START = 'BREAK_START',
  BREAK_END = 'BREAK_END',
}

export enum LeaveRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}
