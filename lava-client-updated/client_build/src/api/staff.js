import client from './client';

export const staffAPI = {
  async getAll() {
    const { data } = await client.get('/staff');
    return data;
  },
  async getSections() {
    const { data } = await client.get('/staff/sections');
    return data;
  },
  async add(staffData) {
    const { data } = await client.post('/staff', staffData);
    return data;
  },
  async update(id, staffData) {
    const { data } = await client.patch(`/staff/${id}`, staffData);
    return data;
  },
  async remove(id) {
    await client.delete(`/staff/${id}`);
  },
};