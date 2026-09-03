import { apiClient } from './client';
import type { ReportInfo, ReportResult } from '../types';

export const reportsApi = {
  async list(): Promise<ReportInfo[]> {
    const { data } = await apiClient.get<ReportInfo[]>('/reports');
    return data;
  },

  async run(
    key: string,
    params: Record<string, string>,
  ): Promise<ReportResult> {
    const { data } = await apiClient.get<ReportResult>(`/reports/${key}`, {
      params: { ...params, format: 'json' },
    });
    return data;
  },

  /** Fetch as a blob and hand the browser a download. */
  async download(
    key: string,
    params: Record<string, string>,
    format: 'csv' | 'xlsx',
  ): Promise<void> {
    const res = await apiClient.get(`/reports/${key}`, {
      params: { ...params, format },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${key}-${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
