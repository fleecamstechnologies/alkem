import { apiClient } from './client';
import type { Customer, Paginated } from '../types';

export interface CustomerListParams {
  q?: string;
  type?: string;
  status?: string;
  city?: string;
  state?: string;
  territory?: string;
  limit?: number;
  page?: number;
  cursor?: string;
}

export const customersApi = {
  async list(params: CustomerListParams): Promise<Paginated<Customer>> {
    const { data } = await apiClient.get<Paginated<Customer>>('/customers', {
      params,
    });
    return data;
  },
  async get(id: string): Promise<Customer> {
    const { data } = await apiClient.get<Customer>(`/customers/${id}`);
    return data;
  },
  async search(q: string): Promise<Customer[]> {
    const { data } = await apiClient.get<Customer[]>('/customers/search', {
      params: { q, limit: 10 },
    });
    return data;
  },
  async create(payload: Partial<Customer>): Promise<Customer> {
    const { data } = await apiClient.post<Customer>('/customers', payload);
    return data;
  },
  async update(id: string, payload: Partial<Customer>): Promise<Customer> {
    const { data } = await apiClient.patch<Customer>(`/customers/${id}`, payload);
    return data;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/customers/${id}`);
  },
};
