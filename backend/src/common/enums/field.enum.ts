export enum PromoItemType {
  SAMPLE = 'SAMPLE',
  GIFT = 'GIFT',
  PRODUCT = 'PRODUCT',
}

export enum StockMovementKind {
  ISSUE = 'ISSUE',
  RETURN = 'RETURN',
  DISTRIBUTE = 'DISTRIBUTE',
  ADJUST = 'ADJUST',
}

export enum TourPlanStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum CallKind {
  DOCTOR = 'DOCTOR',
  CHEMIST = 'CHEMIST',
}

export enum CallProductAction {
  DETAILED = 'DETAILED',
  SAMPLE = 'SAMPLE',
  GIFT = 'GIFT',
  ORDER = 'ORDER',
}

/** Product actions that pull physical stock from the rep. */
export const STOCK_ACTIONS: CallProductAction[] = [
  CallProductAction.SAMPLE,
  CallProductAction.GIFT,
];
