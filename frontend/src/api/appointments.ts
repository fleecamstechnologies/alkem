import { apiClient } from './client';
import type { ApptDashboard, Appointment, Paginated } from '../types';

export interface ApptListParams {
  doctorId?: number;
  patientId?: number;
  status?: string;
  from?: string;
  to?: string;
  mine?: string;
  limit?: number;
  cursor?: string;
}

export const appointmentsApi = {
  async list(params: ApptListParams): Promise<Paginated<Appointment>> {
    const { data } = await apiClient.get<Paginated<Appointment>>(
      '/appointments',
      { params },
    );
    return data;
  },
  async get(id: string): Promise<Appointment> {
    const { data } = await apiClient.get<Appointment>(`/appointments/${id}`);
    return data;
  },
  async book(payload: {
    patientId: number;
    doctorId: number;
    scheduledAt: string;
    type?: string;
    reason?: string;
    durationMin?: number;
  }): Promise<Appointment> {
    const { data } = await apiClient.post<Appointment>('/appointments', payload);
    return data;
  },
  async setStatus(
    id: string,
    status: string,
    cancelReason?: string,
  ): Promise<Appointment> {
    const { data } = await apiClient.patch<Appointment>(
      `/appointments/${id}/status`,
      { status, cancelReason },
    );
    return data;
  },
  async complete(
    id: string,
    payload: {
      createVisit?: boolean;
      chiefComplaint?: string;
      diagnosis?: string;
      clinicalNotes?: string;
    },
  ): Promise<{ appointment: Appointment; visitId: string | null }> {
    const { data } = await apiClient.post<{
      appointment: Appointment;
      visitId: string | null;
    }>(`/appointments/${id}/complete`, payload);
    return data;
  },
  async dashboard(): Promise<ApptDashboard> {
    const { data } = await apiClient.get<ApptDashboard>(
      '/appointments/dashboard',
    );
    return data;
  },
};
