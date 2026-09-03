import { apiClient } from './client';
import type { ImportJob } from '../types';

export type ImportEntity =
  | 'customers'
  | 'payments'
  | 'employees'
  | 'attendance'
  | 'patients'
  | 'visits'
  | 'drugs'
  | 'doctors';

export const importsApi = {
  async upload(
    entity: ImportEntity,
    file: File,
    mapping: Record<string, string>,
    upsert: boolean,
  ): Promise<{ jobId: string; status: string }> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await apiClient.post<{ jobId: string; status: string }>(
      `/imports/${entity}`,
      form,
      {
        params: {
          mapping: JSON.stringify(mapping),
          options: JSON.stringify({ upsert }),
        },
      },
    );
    return data;
  },
  async job(jobId: string): Promise<ImportJob> {
    const { data } = await apiClient.get<ImportJob>(`/imports/${jobId}`);
    return data;
  },
};
