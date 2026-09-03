import { apiClient } from './client';
import type {
  CallReportRow,
  FieldDashboard,
  FieldRepRow,
  Paginated,
  PromoItem,
  RepStockRow,
  StockMovementRow,
  TourPlan,
  TourPlanRow,
} from '../types';

export interface CallProductInput {
  promoItemId: number;
  action: string;
  qty?: string;
  value?: string;
  notes?: string;
}
export interface CallRcpaInput {
  brand: string;
  company?: string;
  units?: number;
  isOwn?: boolean;
  remarks?: string;
}
export interface CallRxInput {
  brand: string;
  rxPerDay?: number;
  remarks?: string;
}
export interface CreateCallReportInput {
  repEmployeeId?: number;
  callDate: string;
  kind: string;
  doctorId?: number;
  customerId?: number;
  area?: string;
  wasPlanned?: boolean;
  remarks?: string;
  products?: CallProductInput[];
  rcpa?: CallRcpaInput[];
  rx?: CallRxInput[];
}
export interface TourDayInput {
  planDate: string;
  area: string;
  plannedCalls?: number;
  notes?: string;
}

export const fieldApi = {
  // reps
  reps: async (): Promise<FieldRepRow[]> =>
    (await apiClient.get<FieldRepRow[]>('/field/reps')).data,
  myRep: async () => (await apiClient.get('/field/reps/me')).data,
  upsertRep: async (
    employeeId: string,
    body: { hq?: string; territory?: string; active?: boolean },
  ) => (await apiClient.put(`/field/reps/${employeeId}`, body)).data,
  assign: async (body: {
    entityType: 'DOCTOR' | 'CUSTOMER';
    entityId: number;
    repEmployeeId: number;
  }) => (await apiClient.post('/field/reps/assign', body)).data,

  // promo items
  promoItems: async (): Promise<PromoItem[]> =>
    (await apiClient.get<PromoItem[]>('/field/promo-items')).data,
  createPromoItem: async (body: Partial<PromoItem>): Promise<PromoItem> =>
    (await apiClient.post<PromoItem>('/field/promo-items', body)).data,
  updatePromoItem: async (
    id: string,
    body: Partial<PromoItem>,
  ): Promise<PromoItem> =>
    (await apiClient.patch<PromoItem>(`/field/promo-items/${id}`, body)).data,

  // stock
  stock: async (repEmployeeId: number | string): Promise<RepStockRow[]> =>
    (await apiClient.get<RepStockRow[]>('/field/stock', { params: { repEmployeeId } }))
      .data,
  movements: async (
    repEmployeeId: number | string,
    from?: string,
    to?: string,
  ): Promise<StockMovementRow[]> =>
    (
      await apiClient.get<StockMovementRow[]>('/field/stock/movements', {
        params: { repEmployeeId, from, to },
      })
    ).data,
  issueStock: async (body: {
    repEmployeeId: number;
    kind?: string;
    movementDate?: string;
    note?: string;
    lines: { promoItemId: number; qty: string }[];
  }) => (await apiClient.post('/field/stock/issue', body)).data,

  // tour plans
  tourPlans: async (params: {
    repEmployeeId?: number;
    periodMonth?: string;
    status?: string;
  }): Promise<TourPlanRow[]> =>
    (await apiClient.get<TourPlanRow[]>('/field/tour-plans', { params })).data,
  tourPlan: async (id: string): Promise<TourPlan> =>
    (await apiClient.get<TourPlan>(`/field/tour-plans/${id}`)).data,
  createTourPlan: async (body: {
    periodMonth: string;
    repEmployeeId?: number;
  }): Promise<TourPlan> =>
    (await apiClient.post<TourPlan>('/field/tour-plans', body)).data,
  setTourDays: async (id: string, days: TourDayInput[]): Promise<TourPlan> =>
    (await apiClient.put<TourPlan>(`/field/tour-plans/${id}/days`, { days })).data,
  submitTourPlan: async (id: string): Promise<TourPlan> =>
    (await apiClient.post<TourPlan>(`/field/tour-plans/${id}/submit`)).data,
  decideTourPlan: async (
    id: string,
    decision: string,
    note?: string,
  ): Promise<TourPlan> =>
    (
      await apiClient.post<TourPlan>(`/field/tour-plans/${id}/decide`, {
        decision,
        note,
      })
    ).data,

  // call reports
  callReports: async (params: {
    repEmployeeId?: number;
    from?: string;
    to?: string;
    kind?: string;
    limit?: number;
    cursor?: string;
  }): Promise<Paginated<CallReportRow>> =>
    (await apiClient.get<Paginated<CallReportRow>>('/field/call-reports', { params }))
      .data,
  callReport: async (id: string) =>
    (await apiClient.get(`/field/call-reports/${id}`)).data,
  createCallReport: async (body: CreateCallReportInput) =>
    (await apiClient.post('/field/call-reports', body)).data,

  // dashboard
  dashboard: async (
    periodMonth: string,
    repEmployeeId?: number,
  ): Promise<FieldDashboard> =>
    (
      await apiClient.get<FieldDashboard>('/field/dashboard', {
        params: { periodMonth, repEmployeeId },
      })
    ).data,
};
