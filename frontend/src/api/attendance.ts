import { apiClient } from './client';
import type {
  AttendanceRecord,
  AttendanceSettings,
  AttendanceSummary,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  MonthGridDay,
  OfficeLocation,
  PunchEventRow,
  Regularization,
} from '../types';

export interface OfficeInput {
  code?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  address?: string;
  isActive?: boolean;
}

export const attendanceApi = {
  async list(params: {
    employeeId?: number;
    departmentId?: number;
    from?: string;
    to?: string;
  }): Promise<AttendanceRecord[]> {
    const { data } = await apiClient.get<AttendanceRecord[]>('/attendance', {
      params,
    });
    return data;
  },
  async mark(payload: {
    employeeId: number;
    date: string;
    status: string;
    leaveTypeId?: number;
    note?: string;
  }): Promise<AttendanceRecord> {
    const { data } = await apiClient.put<AttendanceRecord>('/attendance', payload);
    return data;
  },
  async summary(
    periodMonth: string,
    departmentId?: number,
  ): Promise<AttendanceSummary> {
    const { data } = await apiClient.get<AttendanceSummary>(
      '/attendance/summary',
      { params: { periodMonth, departmentId } },
    );
    return data;
  },
  async monthGrid(
    employeeId: string,
    periodMonth: string,
  ): Promise<MonthGridDay[]> {
    const { data } = await apiClient.get<MonthGridDay[]>(
      `/employees/${employeeId}/attendance`,
      { params: { periodMonth } },
    );
    return data;
  },

  // ---- Phase 9: offices / settings / punch events / regularization ----
  async offices(): Promise<OfficeLocation[]> {
    const { data } = await apiClient.get<OfficeLocation[]>(
      '/attendance/offices',
    );
    return data;
  },
  async createOffice(body: OfficeInput): Promise<OfficeLocation> {
    const { data } = await apiClient.post<OfficeLocation>(
      '/attendance/offices',
      body,
    );
    return data;
  },
  async updateOffice(id: string, body: OfficeInput): Promise<OfficeLocation> {
    const { data } = await apiClient.patch<OfficeLocation>(
      `/attendance/offices/${id}`,
      body,
    );
    return data;
  },
  async deleteOffice(id: string): Promise<void> {
    await apiClient.delete(`/attendance/offices/${id}`);
  },
  async settings(): Promise<AttendanceSettings> {
    const { data } = await apiClient.get<AttendanceSettings>(
      '/attendance/settings',
    );
    return data;
  },
  async saveSettings(
    body: Partial<AttendanceSettings>,
  ): Promise<AttendanceSettings> {
    const { data } = await apiClient.put<AttendanceSettings>(
      '/attendance/settings',
      body,
    );
    return data;
  },
  async punchEvents(params: {
    employeeId?: number;
    from?: string;
    to?: string;
  }): Promise<PunchEventRow[]> {
    const { data } = await apiClient.get<PunchEventRow[]>(
      '/attendance/events',
      { params },
    );
    return data;
  },
  async regularizations(params: {
    status?: string;
    employeeId?: number;
  }): Promise<Regularization[]> {
    const { data } = await apiClient.get<Regularization[]>(
      '/attendance/regularizations',
      { params },
    );
    return data;
  },
  async decideRegularization(
    id: string,
    decision: string,
    note?: string,
  ): Promise<Regularization> {
    const { data } = await apiClient.post<Regularization>(
      `/attendance/regularizations/${id}/decide`,
      { decision, note },
    );
    return data;
  },
};

export const leaveApi = {
  async types(): Promise<LeaveType[]> {
    const { data } = await apiClient.get<LeaveType[]>('/leave/types');
    return data;
  },
  async createType(payload: Partial<LeaveType>): Promise<LeaveType> {
    const { data } = await apiClient.post<LeaveType>('/leave/types', payload);
    return data;
  },
  async updateType(
    id: string,
    payload: Partial<LeaveType>,
  ): Promise<LeaveType> {
    const { data } = await apiClient.patch<LeaveType>(
      `/leave/types/${id}`,
      payload,
    );
    return data;
  },
  async grantQuota(year: number): Promise<{ affected: number }> {
    const { data } = await apiClient.post<{ affected: number }>(
      '/leave/grant-quota',
      { year },
    );
    return data;
  },
  async requests(params: {
    employeeId?: number;
    status?: string;
  }): Promise<LeaveRequest[]> {
    const { data } = await apiClient.get<LeaveRequest[]>('/leave/requests', {
      params,
    });
    return data;
  },
  async request(payload: {
    employeeId: number;
    leaveTypeId: number;
    fromDate: string;
    toDate: string;
    halfDay?: boolean;
    reason?: string;
  }): Promise<LeaveRequest> {
    const { data } = await apiClient.post<LeaveRequest>(
      '/leave/requests',
      payload,
    );
    return data;
  },
  async decide(
    id: string,
    decision: string,
    note?: string,
  ): Promise<LeaveRequest> {
    const { data } = await apiClient.post<LeaveRequest>(
      `/leave/requests/${id}/decide`,
      { decision, note },
    );
    return data;
  },
  async balances(employeeId: string, year?: number): Promise<LeaveBalance[]> {
    const { data } = await apiClient.get<LeaveBalance[]>(
      `/employees/${employeeId}/leave-balances`,
      { params: { year } },
    );
    return data;
  },
};
