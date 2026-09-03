export enum DrugForm {
  TABLET = 'TABLET',
  CAPSULE = 'CAPSULE',
  SYRUP = 'SYRUP',
  INJECTION = 'INJECTION',
  OINTMENT = 'OINTMENT',
  DROPS = 'DROPS',
  CONSUMABLE = 'CONSUMABLE',
  OTHER = 'OTHER',
}

export enum PharmacyMovementKind {
  GRN_IN = 'GRN_IN',
  DISPENSE_OUT = 'DISPENSE_OUT',
  RETURN_IN = 'RETURN_IN',
  ADJUST = 'ADJUST',
  EXPIRY_WRITEOFF = 'EXPIRY_WRITEOFF',
}

export enum GrnStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  CANCELLED = 'CANCELLED',
}

export enum DispenseStatus {
  DISPENSED = 'DISPENSED',
  CANCELLED = 'CANCELLED',
}
