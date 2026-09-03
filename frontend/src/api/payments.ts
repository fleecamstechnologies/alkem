import { apiClient } from './client';
import type {
  DashboardStats,
  Paginated,
  Payment,
  PeriodSummaryRow,
  Statement,
} from '../types';

export interface PaymentListParams {
  customerId?: number;
  kind?: string;
  method?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  page?: number;
  cursor?: string;
}

export interface CreatePaymentPayload {
  customerId: number;
  kind: string;
  amount: string;
  method?: string;
  referenceNo?: string;
  paymentDate: string;
  status?: string;
  notes?: string;
}

export const paymentsApi = {
  async list(params: PaymentListParams): Promise<Paginated<Payment>> {
    const { data } = await apiClient.get<Paginated<Payment>>('/payments', {
      params,
    });
    return data;
  },
  async listForCustomer(
    customerId: string,
    params: PaymentListParams,
  ): Promise<Paginated<Payment>> {
    const { data } = await apiClient.get<Paginated<Payment>>(
      `/customers/${customerId}/payments`,
      { params },
    );
    return data;
  },
  async statement(
    customerId: string,
    from: string,
    to: string,
  ): Promise<Statement> {
    const { data } = await apiClient.get<Statement>(
      `/customers/${customerId}/statement`,
      { params: { from, to } },
    );
    return data;
  },
  async create(payload: CreatePaymentPayload): Promise<Payment> {
    const { data } = await apiClient.post<Payment>('/payments', payload);
    return data;
  },
  async updateStatus(id: string, status: string): Promise<Payment> {
    const { data } = await apiClient.patch<Payment>(`/payments/${id}/status`, {
      status,
    });
    return data;
  },
  async summary(
    from: string,
    to: string,
    groupBy: 'day' | 'month',
  ): Promise<PeriodSummaryRow[]> {
    const { data } = await apiClient.get<PeriodSummaryRow[]>('/payments/summary', {
      params: { from, to, groupBy },
    });
    return data;
  },
  async dashboard(): Promise<DashboardStats> {
    const { data } = await apiClient.get<DashboardStats>('/payments/dashboard');
    return data;
  },
};
