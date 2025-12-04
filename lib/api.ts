import axios from 'axios';

// Flask Backend API URL
const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

// Central API client with Flask backend
const client = axios.create({ 
  baseURL: BACKEND_API_URL,
  headers: {
    'Content-Type': 'application/json',
  }
});

client.interceptors.response.use(r => r, err => {
  console.error('API error', err.response?.status, err.response?.data || err.message);
  console.error('Full error:', err);
  if (err.response) {
    console.error('Response data:', err.response.data);
    console.error('Response headers:', err.response.headers);
  }
  return Promise.reject(err);
});

export const api = {
  // Auth
  register: (email: string, password: string, name?: string) => client.post('/auth/register', { email, password, name }).then(r => r.data),
  login: (email: string, password: string) => client.post('/auth/login', { email, password }).then(r => r.data),
  me: (token?: string) => client.get('/auth/me', { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.data),
  logout: (token?: string) => client.post('/auth/logout', {}, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.data),
  // Channels
  listChannels: (token?: string) => client.get('/chat/channels', { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.data),
  createChannel: (name: string, token?: string) => client.post('/chat/channels', { name }, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.data),
  getChannelDetails: (channelId: string, token?: string) => client.get(`/chat/channels/${channelId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.data),
  addChannelMember: (channelId: string, userId: string, token?: string) => client.post(`/chat/channels/${channelId}/members/${userId}`, {}, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.data),
  removeChannelMember: (channelId: string, userId: string, token?: string) => client.delete(`/chat/channels/${channelId}/members/${userId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.data),
  addChannelMember: (channelId: string, userId: string, token?: string) => client.post(`/chat/channels/${channelId}/members`, { user_id: userId }, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.data),
  removeChannelMember: (channelId: string, userId: string, token?: string) => client.delete(`/chat/channels/${channelId}/members/${userId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.data),
  // Messages
  listMessages: (channelId: string, token?: string) => client.get(`/chat/channels/${channelId}/messages`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.data),
  sendMessage: (channelId: string, content: string, token?: string, attachments?: Array<{name: string; size: number; type: string; url: string}>) => client.post(`/chat/channels/${channelId}/messages/send`, { content, attachments }, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.data),
  // Reactions
  addReaction: (channelId: string, messageId: string, emoji: string, token?: string) => client.post(`/chat/channels/${channelId}/messages/${messageId}/reactions`, { emoji }, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.data),
  removeReaction: (channelId: string, messageId: string, token?: string) => client.delete(`/chat/channels/${channelId}/messages/${messageId}/reactions`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.data),
  // File Upload
  uploadFile: async (file: File, token?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`${BACKEND_API_URL}/upload/message-file`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    return response.data;
  },
  // Direct Messages
  listDMMessages: (recipientId: string, token?: string) => client.get(`/dm/users/${recipientId}/messages`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.data),
  sendDMMessage: (recipientId: string, content: string, token?: string, attachments?: Array<{name: string; size: number; type: string; url: string}>) => client.post(`/dm/users/${recipientId}/messages`, { content, attachments }, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.data),
  listDMConversations: (token?: string) => client.get('/dm/conversations', { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.data),
};
