import axios from 'axios';

// Central API client with basic error handling. Real baseURL inserted later.
// Static code Backend team please change it to dynamic
const client = axios.create({ baseURL: '/' });

client.interceptors.response.use(r => r, err => {
  console.error('API error', err.response?.status, err.response?.data || err.message);
  return Promise.reject(err);
});

export const api = {
  // Auth
  register: (email: string, password: string, name?: string) => client.post('/api/auth/register', { email, password, name }).then(r => r.data),
  login: (email: string, password: string) => client.post('/api/auth/login', { email, password }).then(r => r.data),
  me: (token?: string) => client.get('/api/auth/me', { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.data),
  logout: () => client.post('/api/auth/logout').then(r => r.data),
  // Channels
  listChannels: () => client.get('/api/chat/channels').then(r => r.data),
  createChannel: (name: string) => client.post('/api/chat/channels', { name }).then(r => r.data),
  // Messages
  listMessages: (channelId: string) => client.get(`/api/chat/channels/${channelId}/messages`).then(r => r.data),
  sendMessage: (channelId: string, content: string) => client.post(`/api/chat/channels/${channelId}/messages/send`, { content }).then(r => r.data),
};
