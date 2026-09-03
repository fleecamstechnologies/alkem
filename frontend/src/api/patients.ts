import { apiClient } from './client';
import type {
  MedicalHistory,
  Paginated,
  Patient,
  PatientCharge,
  PatientStatement,
} from '../types';

export interface PatientListParams {
  q?: string;
  assignedDoctorId?: number;
  status?: string;
  city?: string;
  limit?: number;
  page?: number;
  cursor?: string;
}

export const patientsApi = {
  async list(params: PatientListParams): Promise<Paginated<Patient>> {
    const { data } = await apiClient.get<Paginated<Patient>>('/patients', {
      params,
    });
    return data;
  },
  async get(id: string): Promise<Patient> {
    const { data } = await apiClient.get<Patient>(`/patients/${id}`);
    return data;
  },
  async search(q: string): Promise<Patient[]> {
    const { data } = await apiClient.get<Patient[]>('/patients/search', {
      params: { q, limit: 10 },
    });
    return data;
  },
  async create(payload: Partial<Patient>): Promise<Patient> {
    const { data } = await apiClient.post<Patient>('/patients', payload);
    return data;
  },
  async update(id: string, payload: Partial<Patient>): Promise<Patient> {
    const { data } = await apiClient.patch<Patient>(`/patients/${id}`, payload);
    return data;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/patients/${id}`);
  },
  async medicalHistory(id: string): Promise<MedicalHistory> {
    const { data } = await apiClient.get<MedicalHistory>(
      `/patients/${id}/medical-history`,
    );
    return data;
  },
  async charges(
    id: string,
    params: { limit?: number; cursor?: string } = {},
  ): Promise<Paginated<PatientCharge>> {
    const { data } = await apiClient.get<Paginated<PatientCharge>>(
      `/patients/${id}/charges`,
      { params },
    );
    return data;
  },
  async statement(
    id: string,
    from: string,
    to: string,
  ): Promise<PatientStatement> {
    const { data } = await apiClient.get<PatientStatement>(
      `/patients/${id}/statement`,
      { params: { from, to } },
    );
    return data;
  },
  async addCharge(id: string, payload: Partial<PatientCharge>): Promise<PatientCharge> {
    const { data } = await apiClient.post<PatientCharge>(
      `/patients/${id}/charges`,
      payload,
    );
    return data;
  },
};
