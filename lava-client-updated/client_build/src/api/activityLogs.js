import client, { unwrapApiData } from './client';

export const activityLogsAPI = {
  async getAll(params = {}) {
    const response = await client.get('/activity-logs', { params });
    return unwrapApiData(response);
  },
};