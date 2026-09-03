import { apiClient } from './client';
import type {
  EmployeeStatutoryProfile,
  ItSlab,
  Paginated,
  PayRun,
  PayrollDashboard,
  Payslip,
  PayslipDetail,
  PtSlab,
  SalaryComponent,
  SalaryStructure,
  StatutoryConfig,
  TaxDeclarationView,
  TaxRegime,
} from '../types';

export interface StructureLineInput {
  componentId: number;
  calculationType: string;
  value: string;
}

export interface PtSlabInput {
  stateCode?: string;
  stateName?: string;
  effectiveFrom?: string;
  minGross?: string;
  maxGross?: string | null;
  monthlyAmount?: string;
  februaryAmount?: string | null;
  active?: boolean;
}

export interface TaxDeclarationInput {
  regime?: TaxRegime;
  deduction80C?: string;
  deduction80D?: string;
  deduction80CCD1B?: string;
  hraRentPaid?: string;
  homeLoanInterest?: string;
  otherExemptAllowances?: string;
  otherChapterVIA?: string;
  metroCity?: boolean;
  status?: 'SUBMITTED' | 'LOCKED';
}

export const payrollApi = {
  // components
  async components(): Promise<SalaryComponent[]> {
    const { data } = await apiClient.get<SalaryComponent[]>(
      '/payroll/components',
    );
    return data;
  },
  async createComponent(
    payload: Partial<SalaryComponent>,
  ): Promise<SalaryComponent> {
    const { data } = await apiClient.post<SalaryComponent>(
      '/payroll/components',
      payload,
    );
    return data;
  },
  async updateComponent(
    id: string,
    payload: Partial<SalaryComponent>,
  ): Promise<SalaryComponent> {
    const { data } = await apiClient.patch<SalaryComponent>(
      `/payroll/components/${id}`,
      payload,
    );
    return data;
  },
  async deleteComponent(id: string): Promise<void> {
    await apiClient.delete(`/payroll/components/${id}`);
  },

  // structures
  async structure(employeeId: string): Promise<SalaryStructure | null> {
    const { data } = await apiClient.get<SalaryStructure | null>(
      `/payroll/employees/${employeeId}/structure`,
    );
    return data;
  },
  async assignStructure(
    employeeId: string,
    payload: {
      effectiveFrom: string;
      basicMonthly: string;
      lines: StructureLineInput[];
      note?: string;
    },
  ): Promise<SalaryStructure> {
    const { data } = await apiClient.post<SalaryStructure>(
      `/payroll/employees/${employeeId}/structure`,
      payload,
    );
    return data;
  },
  async employeePayslips(employeeId: string): Promise<Payslip[]> {
    const { data } = await apiClient.get<Payslip[]>(
      `/payroll/employees/${employeeId}/payslips`,
    );
    return data;
  },

  // runs
  async runs(): Promise<PayRun[]> {
    const { data } = await apiClient.get<PayRun[]>('/payroll/runs');
    return data;
  },
  async run(id: string): Promise<PayRun> {
    const { data } = await apiClient.get<PayRun>(`/payroll/runs/${id}`);
    return data;
  },
  async createRun(periodMonth: string): Promise<PayRun> {
    const { data } = await apiClient.post<PayRun>('/payroll/runs', {
      periodMonth,
    });
    return data;
  },
  async runAction(
    id: string,
    action: 'process' | 'approve' | 'mark-paid',
  ): Promise<PayRun> {
    const { data } = await apiClient.post<PayRun>(
      `/payroll/runs/${id}/${action}`,
    );
    return data;
  },
  async cancelRun(id: string): Promise<PayRun> {
    const { data } = await apiClient.delete<PayRun>(`/payroll/runs/${id}`);
    return data;
  },
  async payslips(
    runId: string,
    params: { limit?: number; page?: number },
  ): Promise<Paginated<Payslip>> {
    const { data } = await apiClient.get<Paginated<Payslip>>(
      `/payroll/runs/${runId}/payslips`,
      { params },
    );
    return data;
  },
  async payslip(id: string): Promise<PayslipDetail> {
    const { data } = await apiClient.get<PayslipDetail>(
      `/payroll/payslips/${id}`,
    );
    return data;
  },
  async dashboard(): Promise<PayrollDashboard> {
    const { data } = await apiClient.get<PayrollDashboard>(
      '/payroll/dashboard',
    );
    return data;
  },

  // ---- statutory (Phase 8) ----------------------------------
  async statutoryConfig(): Promise<StatutoryConfig> {
    const { data } = await apiClient.get<StatutoryConfig>(
      '/payroll/statutory/config',
    );
    return data;
  },
  async saveStatutoryConfig(
    payload: Partial<StatutoryConfig>,
  ): Promise<StatutoryConfig> {
    const { data } = await apiClient.put<StatutoryConfig>(
      '/payroll/statutory/config',
      payload,
    );
    return data;
  },
  async ptSlabs(): Promise<PtSlab[]> {
    const { data } = await apiClient.get<PtSlab[]>('/payroll/statutory/pt-slabs');
    return data;
  },
  async createPtSlab(payload: PtSlabInput): Promise<PtSlab> {
    const { data } = await apiClient.post<PtSlab>(
      '/payroll/statutory/pt-slabs',
      payload,
    );
    return data;
  },
  async updatePtSlab(id: string, payload: PtSlabInput): Promise<PtSlab> {
    const { data } = await apiClient.patch<PtSlab>(
      `/payroll/statutory/pt-slabs/${id}`,
      payload,
    );
    return data;
  },
  async deletePtSlab(id: string): Promise<void> {
    await apiClient.delete(`/payroll/statutory/pt-slabs/${id}`);
  },
  async itSlabs(fy: string, regime?: TaxRegime): Promise<ItSlab[]> {
    const { data } = await apiClient.get<ItSlab[]>(
      '/payroll/statutory/it-slabs',
      { params: { fy, regime } },
    );
    return data;
  },
  async replaceItSlabs(payload: {
    regime: TaxRegime;
    financialYear: string;
    effectiveFrom: string;
    rows: Array<{ minAnnual: string; maxAnnual: string | null; ratePercent: string }>;
  }): Promise<ItSlab[]> {
    const { data } = await apiClient.put<ItSlab[]>(
      '/payroll/statutory/it-slabs',
      payload,
    );
    return data;
  },
  async employeeStatutory(
    employeeId: string,
  ): Promise<EmployeeStatutoryProfile> {
    const { data } = await apiClient.get<EmployeeStatutoryProfile>(
      `/payroll/employees/${employeeId}/statutory`,
    );
    return data;
  },
  async saveEmployeeStatutory(
    employeeId: string,
    payload: Partial<EmployeeStatutoryProfile>,
  ): Promise<EmployeeStatutoryProfile> {
    const { data } = await apiClient.put<EmployeeStatutoryProfile>(
      `/payroll/employees/${employeeId}/statutory`,
      payload,
    );
    return data;
  },
  async taxDeclaration(
    employeeId: string,
    fy: string,
  ): Promise<TaxDeclarationView> {
    const { data } = await apiClient.get<TaxDeclarationView>(
      `/payroll/employees/${employeeId}/tax-declaration`,
      { params: { fy } },
    );
    return data;
  },
  async saveTaxDeclaration(
    employeeId: string,
    fy: string,
    payload: TaxDeclarationInput,
  ): Promise<TaxDeclarationView> {
    const { data } = await apiClient.put<TaxDeclarationView>(
      `/payroll/employees/${employeeId}/tax-declaration`,
      payload,
      { params: { fy } },
    );
    return data;
  },
};
