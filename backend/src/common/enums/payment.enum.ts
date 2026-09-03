/**
 * A payment row is really a ledger entry. `kind` decides which way it moves the
 * customer's outstanding balance:
 *   INVOICE      -> customer owes more  (+amount)
 *   RECEIPT      -> customer paid us    (-amount)
 *   CREDIT_NOTE  -> we credit customer  (-amount)
 *   ADJUSTMENT   -> manual correction   (+/- via signed amount handling below)
 */
export enum PaymentKind {
  INVOICE = 'INVOICE',
  RECEIPT = 'RECEIPT',
  CREDIT_NOTE = 'CREDIT_NOTE',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CHEQUE = 'CHEQUE',
  NEFT = 'NEFT',
  RTGS = 'RTGS',
  UPI = 'UPI',
  CARD = 'CARD',
  OTHER = 'OTHER',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  CLEARED = 'CLEARED',
  BOUNCED = 'BOUNCED',
  CANCELLED = 'CANCELLED',
}

/** Statuses whose amount actually affects the customer's outstanding balance. */
export const BALANCE_AFFECTING_STATUSES: PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.CLEARED,
];

/**
 * Sign applied to `amount` when folding a ledger entry into the outstanding
 * balance. INVOICE / positive ADJUSTMENT increase what the customer owes.
 */
export function balanceSign(kind: PaymentKind): 1 | -1 {
  return kind === PaymentKind.INVOICE || kind === PaymentKind.ADJUSTMENT ? 1 : -1;
}
