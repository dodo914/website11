import client, { unwrapApiData } from './client';
export const marketingAPI = {
  async getSettings(){ const r=await client.get('/marketing/settings'); return unwrapApiData(r); },
  async updateSettings(marketing){ const r=await client.put('/marketing/settings',{marketing}); return unwrapApiData(r); },
  async sendCampaign(payload){ const r=await client.post('/marketing/campaigns',payload); return unwrapApiData(r); },
  async getStats(){ const r=await client.get('/marketing/stats'); return unwrapApiData(r); },
};
