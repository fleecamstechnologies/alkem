import { apiClient } from './client';
import type { Paginated } from '../types';

export interface Doctor {
  id: string;
  code: string;
  name: string;
  speciality: string | null;
  registrationNo: string | null;
  qualification: string | null;
  phone: string | null;
  email: string | null;
  hospitalName: string | null;
  city: string | null;
  state: string | null;
  territory: string | null;
  linkedCustomerId: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface DoctorListParams {
  q?: string;
  speciality?: string;
  city?: string;
  territory?: string;
  status?: string;
  limit?: number;
  page?: number;
  cursor?: string;
}

export const doctorsApi = {
  async list(params: DoctorListParams): Promise<Paginated<Doctor>> {
    const { data } = await apiClient.get<Paginated<Doctor>>('/doctors', {
      params,
    });
    return data;
  },
  async get(id: string): Promise<Doctor> {
    const { data } = await apiClient.get<Doctor>(`/doctors/${id}`);
    return data;
  },
  async create(payload: Partial<Doctor>): Promise<Doctor> {
    const { data } = await apiClient.post<Doctor>('/doctors', payload);
    return data;
  },
  async update(id: string, payload: Partial<Doctor>): Promise<Doctor> {
    const { data } = await apiClient.patch<Doctor>(`/doctors/${id}`, payload);
    return data;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/doctors/${id}`);
  },
};
