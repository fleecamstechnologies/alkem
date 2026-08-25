export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  PRODUCTION_MANAGER: 'PRODUCTION_MANAGER',
  QC_ANALYST: 'QC_ANALYST',
  QA_MANAGER: 'QA_MANAGER',
  AUDITOR: 'AUDITOR',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const BatchStatus = {
  CREATED: 'CREATED',
  MANUFACTURING: 'MANUFACTURING',
  QC_PENDING: 'QC_PENDING',
  QC_APPROVED: 'QC_APPROVED',
  QA_REVIEW: 'QA_REVIEW',
  RELEASED: 'RELEASED',
  REJECTED: 'REJECTED',
} as const;
export type BatchStatus = (typeof BatchStatus)[keyof typeof BatchStatus];

export const QcSampleStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;
export type QcSampleStatus = (typeof QcSampleStatus)[keyof typeof QcSampleStatus];

export const QcTestName = {
  ASSAY: 'ASSAY',
  DISSOLUTION: 'DISSOLUTION',
  PH: 'PH',
  RELATED_SUBSTANCES: 'RELATED_SUBSTANCES',
  IMPURITY: 'IMPURITY',
  IDENTIFICATION: 'IDENTIFICATION',
  MICROBIOLOGY: 'MICROBIOLOGY',
  STABILITY: 'STABILITY',
  APPEARANCE: 'APPEARANCE',
  WEIGHT_VARIATION: 'WEIGHT_VARIATION',
} as const;
export type QcTestName = (typeof QcTestName)[keyof typeof QcTestName];

export const QcTestResultStatus = {
  PENDING: 'PENDING',
  PASS: 'PASS',
  FAIL: 'FAIL',
} as const;
export type QcTestResultStatus = (typeof QcTestResultStatus)[keyof typeof QcTestResultStatus];

export const QaDecision = {
  RELEASED: 'RELEASED',
  REJECTED: 'REJECTED',
} as const;
export type QaDecision = (typeof QaDecision)[keyof typeof QaDecision];

export const DeviationSeverity = {
  MINOR: 'MINOR',
  MAJOR: 'MAJOR',
  CRITICAL: 'CRITICAL',
} as const;
export type DeviationSeverity = (typeof DeviationSeverity)[keyof typeof DeviationSeverity];

export const DeviationStatus = {
  OPEN: 'OPEN',
  UNDER_INVESTIGATION: 'UNDER_INVESTIGATION',
  CLOSED: 'CLOSED',
} as const;
export type DeviationStatus = (typeof DeviationStatus)[keyof typeof DeviationStatus];

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  manufacturingSite: string | null;
}

export interface Product {
  id: string;
  productCode: string;
  productName: string;
  genericName: string;
  brandName: string | null;
  composition: string;
  strength: string;
  dosageForm: string;
  packSize: string;
  manufacturingSite: string;
  storageCondition: string | null;
  shelfLifeMonths: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface Batch {
  id: string;
  batchNumber: string;
  product: Product;
  productId: string;
  manufacturingDate: string | null;
  batchSize: number;
  productionQuantity: number | null;
  manufacturingSite: string;
  status: BatchStatus;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface QcSample {
  id: string;
  batch: Batch;
  batchId: string;
  sampleType: string;
  sampleQuantity: number;
  collectionDate: string;
  analystUserId: string;
  status: QcSampleStatus;
  createdAt: string;
}

export interface QcTest {
  id: string;
  sampleId: string;
  testName: QcTestName;
  specificationText: string;
  specMin: number | null;
  specMax: number | null;
  actualResultValue: number | null;
  actualResultText: string | null;
  resultStatus: QcTestResultStatus;
  testedByUserId: string | null;
  testedDate: string | null;
  remarks: string | null;
  createdAt: string;
}

export interface QaReview {
  id: string;
  batchId: string;
  reviewerUserId: string;
  decision: QaDecision;
  comments: string;
  reviewedAt: string;
}

export interface Deviation {
  id: string;
  batch: Batch | null;
  batchId: string | null;
  department: string;
  description: string;
  severity: DeviationSeverity;
  status: DeviationStatus;
  raisedByUserId: string;
  rootCause: string | null;
  correctiveAction: string | null;
  closedByUserId: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  totalProducts: number;
  activeProducts: number;
  totalBatches: number;
  qcPending: number;
  qaPending: number;
  released: number;
  rejected: number;
  openDeviations: number;
  batchesByStatus: { status: BatchStatus; count: number }[];
}
