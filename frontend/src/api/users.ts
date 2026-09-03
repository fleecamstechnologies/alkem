import { apiClient } from './client';
import type { UserRole } from '../types';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: string | null;
  employeeId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  department?: string;
  employeeId?: number;
  doctorId?: number;
}

export const usersApi = {
  async list(): Promise<AdminUser[]> {
    const { data } = await apiClient.get<AdminUser[]>('/users');
    return data;
  },
  async create(payload: CreateUserPayload): Promise<AdminUser> {
    const { data } = await apiClient.post<AdminUser>('/users', payload);
    return data;
  },
  async setActive(id: string, active: boolean): Promise<void> {
    await apiClient.patch(`/users/${id}/${active ? 'activate' : 'deactivate'}`);
  },
  async linkEmployee(id: string, employeeId: number): Promise<void> {
    await apiClient.patch(`/users/${id}/employee`, { employeeId });
  },
};
