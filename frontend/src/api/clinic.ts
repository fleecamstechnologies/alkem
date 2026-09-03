import { apiClient } from './client';
import type {
  ClinicBillingDashboard,
  LabTest,
  Paginated,
  Visit,
  VisitDetail,
} from '../types';

export interface MedicineInput {
  drugName: string;
  strength?: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  durationDays?: number;
  quantity?: string;
  instructions?: string;
}

export interface CreateVisitInput {
  patientId: number;
  doctorId: number;
  appointmentId?: number;
  visitDate?: string;
  visitType?: string;
  chiefComplaint?: string;
  bpSystolic?: number;
  bpDiastolic?: number;
  pulse?: number;
  temperature?: string;
  weightKg?: string;
  heightCm?: string;
  spo2?: number;
  diagnosis?: string;
  icdCodes?: string;
  clinicalNotes?: string;
  followUpDate?: string;
  prescriptionNotes?: string;
  medicines?: MedicineInput[];
  labs?: { testName: string; notes?: string }[];
}

export const clinicApi = {
  async patientVisits(
    patientId: string,
    params: { limit?: number; cursor?: string } = {},
  ): Promise<Paginated<Visit>> {
    const { data } = await apiClient.get<Paginated<Visit>>(
      `/patients/${patientId}/visits`,
      { params },
    );
    return data;
  },
  async patientPrescriptions(patientId: string): Promise<
    Array<{
      id: string;
      prescribedAt: string;
      visitId: string | null;
      notes: string | null;
      doctorName: string | null;
      itemCount: number;
    }>
  > {
    const { data } = await apiClient.get(
      `/patients/${patientId}/prescriptions`,
    );
    return data;
  },
  async patientLabs(patientId: string): Promise<LabTest[]> {
    const { data } = await apiClient.get<LabTest[]>(
      `/patients/${patientId}/labs`,
    );
    return data;
  },
  async visit(id: string): Promise<VisitDetail> {
    const { data } = await apiClient.get<VisitDetail>(`/visits/${id}`);
    return data;
  },
  async createVisit(payload: CreateVisitInput): Promise<Visit> {
    const { data } = await apiClient.post<Visit>('/visits', payload);
    return data;
  },
  async orderLab(payload: {
    patientId: number;
    visitId?: number;
    testName: string;
  }): Promise<LabTest> {
    const { data } = await apiClient.post<LabTest>('/labs', payload);
    return data;
  },
  async labResult(
    id: string,
    payload: {
      resultValue: string;
      unit?: string;
      refRange?: string;
      flag?: string;
    },
  ): Promise<LabTest> {
    const { data } = await apiClient.patch<LabTest>(
      `/labs/${id}/result`,
      payload,
    );
    return data;
  },
  async billingDashboard(): Promise<ClinicBillingDashboard> {
    const { data } = await apiClient.get<ClinicBillingDashboard>(
      '/patient-billing/dashboard',
    );
    return data;
  },
};
