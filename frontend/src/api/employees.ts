import { apiClient } from './client';
import type { Department, Employee, Paginated } from '../types';

export interface EmployeeListParams {
  q?: string;
  departmentId?: number;
  status?: string;
  employmentType?: string;
  designation?: string;
  limit?: number;
  page?: number;
  cursor?: string;
}

export const employeesApi = {
  async list(params: EmployeeListParams): Promise<Paginated<Employee>> {
    const { data } = await apiClient.get<Paginated<Employee>>('/employees', {
      params,
    });
    return data;
  },
  async get(id: string): Promise<Employee> {
    const { data } = await apiClient.get<Employee>(`/employees/${id}`);
    return data;
  },
  async search(q: string): Promise<Employee[]> {
    const { data } = await apiClient.get<Employee[]>('/employees/search', {
      params: { q, limit: 10 },
    });
    return data;
  },
  async create(payload: Partial<Employee>): Promise<Employee> {
    const { data } = await apiClient.post<Employee>('/employees', payload);
    return data;
  },
  async update(id: string, payload: Partial<Employee>): Promise<Employee> {
    const { data } = await apiClient.patch<Employee>(`/employees/${id}`, payload);
    return data;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/employees/${id}`);
  },
};

export const departmentsApi = {
  async list(): Promise<Department[]> {
    const { data } = await apiClient.get<Department[]>('/departments');
    return data;
  },
  async create(payload: {
    name: string;
    code?: string;
  }): Promise<Department> {
    const { data } = await apiClient.post<Department>('/departments', payload);
    return data;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/departments/${id}`);
  },
};
