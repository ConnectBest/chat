// In-memory chat data store for mock API.
export interface Channel { id: string; name: string; createdAt: string; }
export interface Message { id: string; channelId: string; content: string; userId: string; createdAt: string; }

const channels: Channel[] = [ { id: 'general', name: 'general', createdAt: new Date().toISOString() } ];
const messages: Message[] = [];

export function listChannels() { return channels; }
export function addChannel(name: string): Channel {
  const existing = channels.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const channel: Channel = { id: name.toLowerCase(), name, createdAt: new Date().toISOString() };
  channels.push(channel);
  return channel;
}
export function listMessages(channelId: string) { return messages.filter(m => m.channelId === channelId); }
export function addMessage(channelId: string, content: string, userId: string): Message {
  const msg: Message = { id: (messages.length + 1).toString(), channelId, content, userId, createdAt: new Date().toISOString() };
  messages.push(msg);
  return msg;
}
