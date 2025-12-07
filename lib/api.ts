/**
 * API Client Library
 * 
 * This library provides a unified interface for making API calls to the Next.js API routes.
 * The Next.js API routes handle authentication via NextAuth session and forward requests
 * to the Flask backend with proper user headers (X-User-ID, X-User-Email, X-User-Role).
 * 
 * NOTE: This uses Next.js API routes (not direct Flask calls) to ensure proper authentication.
 * All token parameters are deprecated and ignored - authentication is handled via NextAuth session.
 */

// Helper function to make authenticated API calls to Next.js API routes
async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `API request failed with status ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth - use Next.js API routes
  me: () => fetchAPI('/api/auth/me'),
  
  // Channels - use Next.js API routes
  listChannels: () => fetchAPI('/api/chat/channels'),
  createChannel: (name: string) => fetchAPI('/api/chat/channels', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }),
  getChannelDetails: (channelId: string) => fetchAPI(`/api/chat/channels/${channelId}`),
  
  // Messages - use Next.js API routes
  listMessages: (channelId: string) => fetchAPI(`/api/chat/channels/${channelId}/messages`),
  sendMessage: (channelId: string, content: string, attachments?: Array<{name: string; size: number; type: string; url: string}>) => 
    fetchAPI(`/api/chat/channels/${channelId}/messages/send`, {
      method: 'POST',
      body: JSON.stringify({ content, attachments }),
    }),
  
  // Reactions - use Next.js API routes
  addReaction: (channelId: string, messageId: string, emoji: string) => 
    fetchAPI(`/api/chat/channels/${channelId}/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),
  removeReaction: (channelId: string, messageId: string) => 
    fetchAPI(`/api/chat/channels/${channelId}/messages/${messageId}/reactions`, {
      method: 'DELETE',
    }),
  
  // File Upload - use Next.js API route
  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/upload/message-file', {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - let browser set it with boundary
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'File upload failed');
    }
    
    return response.json();
  },
  
  // Direct Messages - use Next.js API routes
  listDMMessages: (recipientId: string) => fetchAPI(`/api/dm/users/${recipientId}/messages`),
  sendDMMessage: (recipientId: string, content: string, attachments?: Array<{name: string; size: number; type: string; url: string}>) => 
    fetchAPI(`/api/dm/users/${recipientId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, attachments }),
    }),
  listDMConversations: () => fetchAPI('/api/dm/conversations'),
};
