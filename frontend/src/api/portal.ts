import { apiClient } from './client';
import type {
  Employee,
  LeaveBalance,
  LeaveRequest,
  MonthGridDay,
  Payslip,
  PayslipDetail,
  PunchStatus,
  PunchType,
  Regularization,
  TaxDeclarationView,
} from '../types';
import type { TaxDeclarationInput } from './payroll';

export interface PunchBody {
  type: PunchType;
  latitude: number;
  longitude: number;
  accuracyM?: number;
  localDate: string;
  note?: string;
}
export interface RegularizationBody {
  date: string;
  inAt: string;
  outAt: string;
  reason: string;
}

export interface TeamMember {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  designation: string | null;
  status: string;
  departmentId: string | null;
}

export interface ApprovalRow {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  days: string;
  halfDay: number;
  reason: string | null;
  status: string;
  createdAt: string;
  employeeCode: string;
  employeeName: string;
  leaveTypeCode: string;
}

export const portalApi = {
  async me(): Promise<Employee> {
    const { data } = await apiClient.get<Employee>('/me');
    return data;
  },
  async updateProfile(payload: Partial<Employee>): Promise<Employee> {
    const { data } = await apiClient.patch<Employee>('/me/profile', payload);
    return data;
  },
  async payslips(): Promise<Payslip[]> {
    const { data } = await apiClient.get<Payslip[]>('/me/payslips');
    return data;
  },
  async payslip(id: string): Promise<PayslipDetail> {
    const { data } = await apiClient.get<PayslipDetail>(`/me/payslips/${id}`);
    return data;
  },
  async taxDeclaration(fy: string): Promise<TaxDeclarationView> {
    const { data } = await apiClient.get<TaxDeclarationView>(
      '/me/tax-declaration',
      { params: { fy } },
    );
    return data;
  },
  async saveTaxDeclaration(
    fy: string,
    payload: TaxDeclarationInput,
  ): Promise<TaxDeclarationView> {
    const { data } = await apiClient.put<TaxDeclarationView>(
      '/me/tax-declaration',
      payload,
      { params: { fy } },
    );
    return data;
  },
  async attendance(periodMonth: string): Promise<MonthGridDay[]> {
    const { data } = await apiClient.get<MonthGridDay[]>('/me/attendance', {
      params: { periodMonth },
    });
    return data;
  },

  // ---- punch in / out + breaks ----------------------------
  async punchStatus(date?: string): Promise<PunchStatus> {
    const { data } = await apiClient.get<PunchStatus>('/me/punch/status', {
      params: date ? { date } : undefined,
    });
    return data;
  },
  async punch(body: PunchBody): Promise<PunchStatus> {
    const { data } = await apiClient.post<PunchStatus>('/me/punch', body);
    return data;
  },

  // ---- attendance regularization -------------------------
  async regularizations(): Promise<Regularization[]> {
    const { data } = await apiClient.get<Regularization[]>(
      '/me/regularizations',
    );
    return data;
  },
  async requestRegularization(
    body: RegularizationBody,
  ): Promise<Regularization> {
    const { data } = await apiClient.post<Regularization>(
      '/me/regularizations',
      body,
    );
    return data;
  },
  async cancelRegularization(id: string): Promise<Regularization> {
    const { data } = await apiClient.post<Regularization>(
      `/me/regularizations/${id}/cancel`,
    );
    return data;
  },
  async regularizationApprovals(): Promise<Regularization[]> {
    const { data } = await apiClient.get<Regularization[]>(
      '/me/regularization-approvals',
    );
    return data;
  },
  async decideRegularization(
    id: string,
    decision: string,
    note?: string,
  ): Promise<Regularization> {
    const { data } = await apiClient.post<Regularization>(
      `/me/regularizations/${id}/decide`,
      { decision, note },
    );
    return data;
  },
  async leaveBalances(year: number): Promise<LeaveBalance[]> {
    const { data } = await apiClient.get<LeaveBalance[]>('/me/leave-balances', {
      params: { year },
    });
    return data;
  },
  async leaveRequests(): Promise<LeaveRequest[]> {
    const { data } = await apiClient.get<LeaveRequest[]>('/me/leave-requests');
    return data;
  },
  async requestLeave(payload: {
    leaveTypeId: number;
    fromDate: string;
    toDate: string;
    halfDay?: boolean;
    reason?: string;
  }): Promise<LeaveRequest> {
    const { data } = await apiClient.post<LeaveRequest>(
      '/me/leave-requests',
      payload,
    );
    return data;
  },
  async cancelLeave(id: string): Promise<LeaveRequest> {
    const { data } = await apiClient.post<LeaveRequest>(
      `/me/leave-requests/${id}/cancel`,
    );
    return data;
  },
  async team(): Promise<TeamMember[]> {
    const { data } = await apiClient.get<TeamMember[]>('/me/team');
    return data;
  },
  async approvals(): Promise<ApprovalRow[]> {
    const { data } = await apiClient.get<ApprovalRow[]>('/me/approvals');
    return data;
  },
  async decide(id: string, decision: string, note?: string): Promise<unknown> {
    const { data } = await apiClient.post(`/me/approvals/${id}/decide`, {
      decision,
      note,
    });
    return data;
  },
  async teamAttendance(
    employeeId: string,
    periodMonth: string,
  ): Promise<MonthGridDay[]> {
    const { data } = await apiClient.get<MonthGridDay[]>(
      `/me/team/${employeeId}/attendance`,
      { params: { periodMonth } },
    );
    return data;
  },
};
