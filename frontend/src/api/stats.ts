import { apiClient } from './client';
import type { RecordCounts } from '../types';

export const statsApi = {
  async counts(): Promise<RecordCounts> {
    const { data } = await apiClient.get<RecordCounts>('/stats/counts');
    return data;
  },
};
