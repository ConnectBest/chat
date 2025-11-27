"use client";
import React, { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmojiPicker, ReactionBar } from './EmojiPicker';
import { ThreadPanel } from './ThreadPanel';
import { FileUploader } from './FileUploader';
import { SearchBar } from './SearchBar';
import { TypingIndicator } from './TypingIndicator';
import { ChannelHeader } from './ChannelHeader';
import { CallControls } from './CallControls';
import { MentionAutocomplete } from './MentionAutocomplete';
import { GifPicker } from './GifPicker';
import { Avatar } from '@/components/ui/Avatar';
import { UserProfilePopover } from '@/components/ui/UserProfilePopover';
import { ClipsRecorder } from './ClipsRecorder';
import { AIAssistant } from './AIAssistant';

interface Message { 
  id: string; 
  content: string; 
  createdAt: string; 
  userId: string; 
  reactions?: { emoji: string; count: number; users: string[] }[]; 
  attachments?: { name: string; size: number; type: string; url?: string }[];
  edited?: boolean;
  pinned?: boolean;
  bookmarked?: boolean;
  gifUrl?: string;
  linkPreview?: { url: string; title: string; description: string; image?: string };
  scheduledFor?: string;
  isScheduled?: boolean;
}

export function ChannelView({ channelId, isDM = false, dmUserId }: { channelId: string; isDM?: boolean; dmUserId?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);
  const [threadMessage, setThreadMessage] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [dmUserName, setDmUserName] = useState<string>('');
  const [channelName, setChannelName] = useState<string>(channelId);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [showPinnedMessages, setShowPinnedMessages] = useState<boolean>(false);
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [clickedMessageUser, setClickedMessageUser] = useState<{id: string; name: string; email: string; phone?: string; status: 'online' | 'away' | 'busy' | 'inmeeting' | 'offline'; statusMessage?: string} | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [showClips, setShowClips] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [dmUserData, setDmUserData] = useState<{
    id: string;
    name: string;
    email: string;
    phone?: string;
    status: 'online' | 'away' | 'busy' | 'inmeeting' | 'offline';
    statusMessage?: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pinnedMessages = messages.filter(m => m.pinned);

  // Mock users for mentions
  const allUsers = [
    { id: '1', name: 'Current User', email: 'current@example.com', status: 'online' as const },
    { id: '2', name: 'Alice Johnson', email: 'alice@example.com', status: 'online' as const },
    { id: '3', name: 'Bob Smith', email: 'bob@example.com', status: 'away' as const },
    { id: '4', name: 'Carol Williams', email: 'carol@example.com', status: 'online' as const },
    { id: '5', name: 'David Brown', email: 'david@example.com', status: 'offline' as const },
  ];
  useEffect(() => {
    let mounted = true;
    if (isDM && dmUserId) {
      // Mock DM user lookup - Static code Backend team please change it to dynamic
      const userMap: Record<string, { name: string; email: string; phone?: string; status: 'online' | 'away' | 'busy' | 'inmeeting' | 'offline'; statusMessage?: string }> = {
        '2': { name: 'Alice Johnson', email: 'alice@example.com', phone: '+1 234-567-8901', status: 'online', statusMessage: 'Working on the new project 🚀' },
        '3': { name: 'Bob Smith', email: 'bob@example.com', phone: '+1 234-567-8902', status: 'away', statusMessage: 'In a meeting, back soon' },
        '4': { name: 'Carol Williams', email: 'carol@example.com', status: 'busy', statusMessage: 'Do not disturb' },
        '5': { name: 'David Brown', email: 'david@example.com', phone: '+1 234-567-8904', status: 'offline' },
      };
      const userData = userMap[dmUserId] || { name: 'Unknown User', email: 'unknown@example.com', status: 'offline' as const };
      setDmUserName(userData.name);
      setDmUserData({ id: dmUserId, ...userData });
      // Load DM messages - Static code Backend team please change it to dynamic
      setMessages([
        { id: '1', content: 'Hey! How are you?', createdAt: new Date(Date.now() - 3600000).toISOString(), userId: dmUserId },
        { id: '2', content: 'I am good, thanks! How about you?', createdAt: new Date(Date.now() - 1800000).toISOString(), userId: '1' },
      ]);
    } else {
      api.listMessages(channelId).then(data => mounted && setMessages(data.messages));
    }
    
    // Static code Backend team please change it to dynamic
    // TODO: Socket.io listener for typing events
    // socket.on('user-typing', ({ userId, channelId: typingChannelId }) => {
    //   if (typingChannelId === channelId) {
    //     setTypingUsers(prev => [...new Set([...prev, userId])]);
    //   }
    // });
    
    return () => { mounted = false; };
  }, [channelId]);

  async function send() {
    if (!content.trim() && attachedFiles.length === 0) return;
    setLoading(true);
    try {
      // Static code Backend team please change it to dynamic
      const attachments = attachedFiles.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type
      }));
      
      // Extract link preview
      const linkPreview = await extractLinkPreview(content);
      
      const { message } = await api.sendMessage(channelId, content.trim() || '📎 File attachment');
      setMessages(prev => [...prev, { ...message, reactions: [], attachments, linkPreview: linkPreview || undefined }]);
      setContent('');
      setAttachedFiles([]);
    } finally { setLoading(false); }
  }

  function handleReaction(messageId: string, emoji: string) {
    // Static code Backend team please change it to dynamic
    const currentUserId = '1'; // Mock current user ID
    setShowEmojiPicker(null); // Close picker after selection
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      
      let reactions = [...(m.reactions || [])]; // Create new array
      
      // First, remove user's existing reaction from any emoji
      reactions = reactions.map(r => ({
        ...r,
        users: r.users.filter(u => u !== currentUserId),
        count: r.users.filter(u => u !== currentUserId).length
      })).filter(r => r.count > 0); // Remove reactions with 0 count
      
      // Then add the new reaction
      const existingIndex = reactions.findIndex(r => r.emoji === emoji);
      if (existingIndex >= 0) {
        // Add user to existing emoji reaction
        reactions[existingIndex] = {
          ...reactions[existingIndex],
          count: reactions[existingIndex].count + 1,
          users: [...reactions[existingIndex].users, currentUserId]
        };
      } else {
        // Create new reaction
        reactions.push({ emoji, count: 1, users: [currentUserId] });
      }
      
      return { ...m, reactions };
    }));
  }

  async function handleFileUpload(files: File[]) {
    // Static code Backend team please change it to dynamic
    setAttachedFiles(prev => [...prev, ...files]);
  }

  function handleInputChange(value: string) {
    setContent(value);
    
    // Check for @ mentions
    const lastAtSymbol = value.lastIndexOf('@');
    if (lastAtSymbol !== -1 && lastAtSymbol === value.length - 1) {
      // Just typed @
      setShowMentionAutocomplete(true);
      setMentionQuery('');
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setMentionPosition({ top: rect.top - 250, left: rect.left });
      }
    } else if (lastAtSymbol !== -1) {
      const afterAt = value.substring(lastAtSymbol + 1);
      if (!afterAt.includes(' ') && afterAt.length > 0) {
        setShowMentionAutocomplete(true);
        setMentionQuery(afterAt);
        if (inputRef.current) {
          const rect = inputRef.current.getBoundingClientRect();
          setMentionPosition({ top: rect.top - 250, left: rect.left });
        }
      } else if (afterAt.includes(' ')) {
        setShowMentionAutocomplete(false);
      }
    } else {
      setShowMentionAutocomplete(false);
    }
    
    // Static code Backend team please change it to dynamic
    // TODO: Emit typing event via socket
    // socket.emit('typing', { channelId, userId: currentUser.id });
  }

  function handleMentionSelect(user: { id: string; name: string; email: string; status: 'online' | 'away' | 'offline' }) {
    const lastAtSymbol = content.lastIndexOf('@');
    const beforeAt = content.substring(0, lastAtSymbol);
    setContent(beforeAt + '@' + user.name + ' ');
    setShowMentionAutocomplete(false);
    inputRef.current?.focus();
  }

  function handleGifSelect(gifUrl: string) {
    // Send message with GIF
    const newMessage: Message = {
      id: Date.now().toString(),
      content: content || '',
      createdAt: new Date().toISOString(),
      userId: '1',
      gifUrl
    };
    setMessages(prev => [...prev, newMessage]);
    setContent('');
    setShowGifPicker(false);
  }

  async function extractLinkPreview(text: string) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex);
    if (!urls || urls.length === 0) return null;
    
    // Static code Backend team please change it to dynamic - Fetch actual link previews
    // Mock preview for now
    return {
      url: urls[0],
      title: 'Link Preview',
      description: 'This is a preview of the shared link',
      image: 'https://via.placeholder.com/400x200'
    };
  }

  function startEditMessage(message: Message) {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  }

  function cancelEdit() {
    setEditingMessageId(null);
    setEditContent('');
  }

  async function saveEdit(messageId: string) {
    if (!editContent.trim()) return;
    // Static code Backend team please change it to dynamic - PUT /api/messages/:id
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, content: editContent.trim(), edited: true } : m
    ));
    setEditingMessageId(null);
    setEditContent('');
  }

  async function deleteMessage(messageId: string) {
    if (!confirm('Delete this message? This cannot be undone.')) return;
    // Static code Backend team please change it to dynamic - DELETE /api/messages/:id
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }

  function togglePinMessage(messageId: string) {
    // Static code Backend team please change it to dynamic - POST /api/messages/:id/pin
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, pinned: !m.pinned } : m
    ));
  }

  function toggleBookmarkMessage(messageId: string) {
    // Static code Backend team please change it to dynamic - POST /api/messages/:id/bookmark
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, bookmarked: !m.bookmarked } : m
    ));
  }

  function formatMessage(text: string) {
    // Simple markdown-like formatting
    let formatted = text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // **bold**
      .replace(/\*(.+?)\*/g, '<em>$1</em>') // *italic*
      .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 bg-white/10 rounded text-sm">$1</code>') // `code`
      .replace(/~~(.+?)~~/g, '<del>$1</del>') // ~~strikethrough~~
      .replace(/@(\w+)/g, '<span class="text-brand-400 font-medium">@$1</span>') // @mentions
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-brand-400 hover:underline">$1</a>'); // links
    return formatted;
  }

  function insertFormatting(format: 'bold' | 'italic' | 'code' | 'strike') {
    const formats = {
      bold: '**',
      italic: '*',
      code: '`',
      strike: '~~'
    };
    const marker = formats[format];
    setContent(prev => prev + marker + 'text' + marker);
  }

  function startRecording() {
    setIsRecording(true);
    setRecordingTime(0);
    // Static code Backend team please change it to dynamic - Start actual audio recording
    const interval = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
    // Store interval ID to clear later
    (window as any).recordingInterval = interval;
  }

  function stopRecording() {
    setIsRecording(false);
    clearInterval((window as any).recordingInterval);
    // Static code Backend team please change it to dynamic - Stop recording and send
    const audioMessage: Message = {
      id: Date.now().toString(),
      content: `🎤 Voice message (${recordingTime}s)`,
      createdAt: new Date().toISOString(),
      userId: '1'
    };
    setMessages(prev => [...prev, audioMessage]);
    setRecordingTime(0);
  }

  function cancelRecording() {
    setIsRecording(false);
    clearInterval((window as any).recordingInterval);
    setRecordingTime(0);
  }

  function formatRecordingTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getDateSeparator(date: string) {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      const dayName = messageDate.toLocaleDateString('en-US', { weekday: 'long' });
      const isWithinWeek = (today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24) < 7;
      if (isWithinWeek) {
        return dayName;
      }
      return messageDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  }

  function shouldShowDateSeparator(currentMsg: Message, prevMsg: Message | undefined) {
    if (!prevMsg) return true;
    const currentDate = new Date(currentMsg.createdAt).toDateString();
    const prevDate = new Date(prevMsg.createdAt).toDateString();
    return currentDate !== prevDate;
  }

  function openSchedulePicker() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    setScheduleDate(dateStr);
    setScheduleTime(timeStr);
    setShowSchedulePicker(true);
  }

  function scheduleMessage() {
    if (!content.trim() || !scheduleDate || !scheduleTime) return;
    
    const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
    const now = new Date();
    
    if (scheduledDateTime <= now) {
      alert('Please select a future date and time');
      return;
    }

    // Static code Backend team please change it to dynamic - POST /api/messages/schedule
    const scheduledMessage: Message = {
      id: Date.now().toString(),
      content,
      createdAt: scheduledDateTime.toISOString(),
      userId: '1',
      isScheduled: true,
      scheduledFor: scheduledDateTime.toISOString()
    };

    // Store scheduled message (will be sent at scheduled time)
    console.log('Message scheduled for:', scheduledDateTime);
    alert(`Message scheduled for ${scheduledDateTime.toLocaleString()}`);
    
    setContent('');
    setAttachedFiles([]);
    setShowSchedulePicker(false);
    setScheduleDate('');
    setScheduleTime('');
  }

  function getQuickScheduleTime(option: 'morning' | 'afternoon' | 'tomorrow' | 'monday') {
    const now = new Date();
    let scheduledTime = new Date();

    switch(option) {
      case 'morning': // Tomorrow at 9 AM
        scheduledTime.setDate(now.getDate() + 1);
        scheduledTime.setHours(9, 0, 0, 0);
        break;
      case 'afternoon': // Today at 2 PM
        scheduledTime.setHours(14, 0, 0, 0);
        if (scheduledTime <= now) {
          scheduledTime.setDate(now.getDate() + 1);
        }
        break;
      case 'tomorrow': // Tomorrow at same time
        scheduledTime.setDate(now.getDate() + 1);
        break;
      case 'monday': // Next Monday at 9 AM
        const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
        scheduledTime.setDate(now.getDate() + daysUntilMonday);
        scheduledTime.setHours(9, 0, 0, 0);
        break;
    }

    setScheduleDate(scheduledTime.toISOString().split('T')[0]);
    setScheduleTime(scheduledTime.toTimeString().slice(0, 5));
  }

  function handleClipSend(clipUrl: string, clipType: 'video' | 'audio', duration: number) {
    const clipMessage: Message = {
      id: Date.now().toString(),
      content: `${clipType === 'video' ? '📹' : '🎤'} ${clipType === 'video' ? 'Video' : 'Audio'} Clip (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})`,
      createdAt: new Date().toISOString(),
      userId: '1'
    };
    setMessages(prev => [...prev, clipMessage]);
    // Static code Backend team please change it to dynamic - Upload clip and POST /api/messages
  }

  function handleAIInsert(text: string) {
    setContent(text);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header with DM indicator or Channel Header */}
      {isDM ? (
        <div className="flex-shrink-0 px-4 py-3 border-b border-white/10 bg-brand-900/50">
          <div className="flex items-center justify-between">
            <button 
              onClick={(e) => {
                setPopoverPosition({ x: e.clientX, y: e.clientY });
                setShowUserProfile(true);
              }}
              className="flex items-center gap-3 hover:opacity-80 transition"
            >
              {dmUserData && (
                <Avatar 
                  name={dmUserData.name} 
                  status={dmUserData.status} 
                  size="md" 
                />
              )}
              <span className="font-semibold text-white">{dmUserName}</span>
            </button>
            <CallControls isDM={true} dmUserId={dmUserId} dmUserName={dmUserName} />
          </div>
        </div>
      ) : (
        <ChannelHeader 
          channelId={channelId} 
          channelName={channelName}
          memberCount={2}
          onUpdateChannel={(name, members) => {
            setChannelName(name);
            console.log('Channel updated:', name, members);
            // Static code Backend team please change it to dynamic - PUT /api/channels/:id
          }}
        />
      )}

      {/* Search Bar */}
      <div className="flex-shrink-0 p-3 border-b border-white/10">
        <SearchBar onResultClick={result => console.log('Navigate to:', result)} />
      </div>

      {/* Pinned Messages Banner */}
      {pinnedMessages.length > 0 && (
        <div className="flex-shrink-0 bg-brand-500/20 border-b border-brand-500/30 p-2 px-3">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setShowPinnedMessages(!showPinnedMessages)}
              className="text-sm text-brand-300 hover:text-brand-200 flex items-center gap-2"
            >
              📌 {pinnedMessages.length} Pinned Message{pinnedMessages.length > 1 ? 's' : ''}
              <span className="text-xs">{showPinnedMessages ? '▲' : '▼'}</span>
            </button>
          </div>
          {showPinnedMessages && (
            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto scrollbar-thin">
              {pinnedMessages.map(m => (
                <div key={`pinned-${m.id}`} className="text-xs bg-white/5 rounded p-2">
                  <div className="text-white/50">{new Date(m.createdAt).toLocaleTimeString()} • user {m.userId}</div>
                  <div className="text-white" dangerouslySetInnerHTML={{ __html: formatMessage(m.content) }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin min-h-0" style={{ background: 'linear-gradient(to bottom, #3d4b6d, #2f3a52)' }} role="log" aria-live="polite">
        {messages.map((m, index) => {
          const messageUser = m.userId === dmUserId && dmUserData ? dmUserData : null;
          const isCurrentUser = m.userId === '1';
          const showDateSeparator = shouldShowDateSeparator(m, messages[index - 1]);
          
          return (
            <React.Fragment key={`msg-${m.id}-${index}`}>
              {/* Date Separator */}
              {showDateSeparator && (
                <div className="flex justify-center my-4">
                  <div className="bg-dark-700/80 text-white/70 text-xs px-3 py-1 rounded-full">
                    {getDateSeparator(m.createdAt)}
                  </div>
                </div>
              )}

              {/* Message */}
              <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} group`}>
                {/* Avatar for received messages */}
                {!isCurrentUser && messageUser && (
                  <button
                    onClick={(e) => {
                      setPopoverPosition({ x: e.clientX, y: e.clientY });
                      setClickedMessageUser(messageUser);
                    }}
                    className="flex-shrink-0 hover:opacity-80 transition mr-2 self-end"
                  >
                    <Avatar 
                      name={messageUser.name} 
                      status={messageUser.status} 
                      size="sm" 
                    />
                  </button>
                )}

                <div className={`max-w-[65%] ${isCurrentUser ? 'bg-brand-600/90' : 'bg-white/10'} rounded-lg px-3 py-2 shadow-lg relative group`}>
                  {/* Message header with username for received messages */}
                  {!isCurrentUser && messageUser && (
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={(e) => {
                          setPopoverPosition({ x: e.clientX, y: e.clientY });
                          setClickedMessageUser(messageUser);
                        }}
                        className="font-semibold text-brand-400 hover:underline text-sm"
                      >
                        {messageUser.name}
                      </button>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className={`absolute top-2 opacity-0 group-hover:opacity-100 flex gap-1 ${isCurrentUser ? 'left-[-160px]' : 'right-[-160px]'}`}>
                    <button 
                      onClick={() => setThreadMessage(m)}
                      className="text-white/50 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition"
                      title="Reply in thread"
                    >
                      💬
                    </button>
                    <button 
                      onClick={() => toggleBookmarkMessage(m.id)}
                      className={`text-xs px-2 py-1 rounded hover:bg-white/10 transition ${m.bookmarked ? 'text-yellow-400' : 'text-white/50 hover:text-yellow-400'}`}
                      title={m.bookmarked ? "Remove bookmark" : "Bookmark message"}
                    >
                      ⭐
                    </button>
                    {m.pinned && <span className="text-brand-400 text-xs px-2 py-1">📌</span>}
                    {isCurrentUser && (
                      <>
                        <button 
                          onClick={() => startEditMessage(m)}
                          className="text-white/50 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition"
                          title="Edit message"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => deleteMessage(m.id)}
                          className="text-white/50 hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-white/10 transition"
                          title="Delete message"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>

                  {/* Message content */}
                  {editingMessageId === m.id ? (
                    <div className="mt-2 space-y-2">
                      <Input 
                        value={editContent} 
                        onChange={e => setEditContent(e.target.value)}
                        placeholder="Edit message..."
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button onClick={() => saveEdit(m.id)} className="text-xs">Save</Button>
                        <Button variant="secondary" onClick={cancelEdit} className="text-xs">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-white text-sm" dangerouslySetInnerHTML={{ __html: formatMessage(m.content) }} />
                      {m.gifUrl && (
                        <div className="mt-2">
                          <img src={m.gifUrl} alt="GIF" className="rounded max-w-full max-h-48 object-cover" />
                        </div>
                      )}
                      {m.linkPreview && (
                        <div className="mt-2 border border-white/20 rounded overflow-hidden">
                          {m.linkPreview.image && (
                            <img src={m.linkPreview.image} alt={m.linkPreview.title} className="w-full h-24 object-cover" />
                          )}
                          <div className="p-2 bg-white/5">
                            <div className="text-white font-medium text-xs truncate">{m.linkPreview.title}</div>
                            <div className="text-white/50 text-xs mt-1 line-clamp-2">{m.linkPreview.description}</div>
                          </div>
                        </div>
                      )}
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {m.attachments.map((file, idx) => (
                            <div key={`attachment-${m.id}-${idx}`} className="flex items-center gap-2 bg-white/10 rounded px-2 py-1 text-xs">
                              <span className="text-lg">
                                {file.type.startsWith('image/') ? '🖼️' : 
                                 file.type.includes('pdf') ? '📄' : 
                                 file.type.includes('zip') ? '📦' : '📎'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-white font-medium truncate">{file.name}</div>
                                <div className="text-white/50 text-xs">{(file.size / 1024).toFixed(1)} KB</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Timestamp and status */}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-white/50 text-[10px]">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {m.edited && <span className="text-white/40 text-[10px]">(edited)</span>}
                    {isCurrentUser && <span className="text-blue-400 text-xs">✓✓</span>}
                  </div>

                  {/* Reactions */}
                  {m.reactions && m.reactions.length > 0 && (
                    <ReactionBar
                      reactions={m.reactions}
                      onReact={emoji => handleReaction(m.id, emoji)}
                      onShowPicker={() => setShowEmojiPicker(m.id)}
                    />
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {!messages.length && <div className="text-white/40 text-sm">No messages yet.</div>}
      </div>
      
      <TypingIndicator users={typingUsers} />
      
      {attachedFiles.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-t border-white/10 bg-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/70 text-sm font-medium">{attachedFiles.length} file(s) attached</span>
            <button
              onClick={() => setAttachedFiles([])}
              className="text-white/50 hover:text-white text-xs"
            >
              Clear all
            </button>
          </div>
          <div className="space-y-1">
            {attachedFiles.map((file, idx) => (
              <div key={`file-${file.name}-${idx}`} className="flex items-center gap-2 bg-white/10 rounded px-2 py-1.5 text-sm">
                <span className="text-lg">
                  {file.type.startsWith('image/') ? '🖼️' : 
                   file.type.includes('pdf') ? '📄' : 
                   file.type.includes('zip') ? '📦' : '📎'}
                </span>
                <span className="text-white flex-1 truncate">{file.name}</span>
                <span className="text-white/50 text-xs">{(file.size / 1024).toFixed(1)} KB</span>
                <button
                  onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))}
                  className="text-white/50 hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <form
        onSubmit={e => { e.preventDefault(); send(); }}
        className="flex-shrink-0 p-3 border-t border-white/10 flex gap-2 relative"
        aria-label="Send message form"
      >
        {!isRecording ? (
          <>
            <FileUploader onUpload={handleFileUpload} />
            
            {/* AI Assistant Button */}
            <button
              type="button"
              onClick={() => setShowAI(true)}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded transition flex items-center justify-center"
              title="AI Assistant"
            >
              <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-500 rounded flex items-center justify-center text-sm">
                ✨
              </div>
            </button>
            
            {/* Clips Button */}
            <button
              type="button"
              onClick={() => setShowClips(true)}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded transition"
              title="Record a clip"
            >
              🎬
            </button>
            
            {/* Message Input with Emoji Button Inside */}
            <div className="flex-1 relative">
              <Input 
                ref={inputRef}
                value={content} 
                onChange={e => handleInputChange(e.target.value)} 
                placeholder={`Message #${channelId}`} 
                aria-label="Message input"
                className="pr-12 animate-pulse-cursor"
              />
              <button
                type="button"
                onClick={() => setShowInputEmojiPicker(!showInputEmojiPicker)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-xl hover:bg-white/10 rounded transition"
                aria-label="Add emoji to message"
              >
                😀
              </button>
              {showMentionAutocomplete && (
                <MentionAutocomplete
                  users={allUsers}
                  searchQuery={mentionQuery}
                  onSelect={handleMentionSelect}
                  position={mentionPosition}
                />
              )}
            </div>
            
            {content.trim() || attachedFiles.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={openSchedulePicker}
                  className="p-3 text-white/70 hover:text-white hover:bg-white/10 rounded transition"
                  title="Schedule message"
                >
                  🕐
                </button>
                <Button type="submit" loading={loading}>Send</Button>
              </>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="p-3 bg-brand-500 hover:bg-brand-600 rounded-full transition flex items-center justify-center"
                title="Record voice message"
              >
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="text-white"
                >
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={cancelRecording}
              className="p-3 bg-red-500 hover:bg-red-600 rounded-full transition"
              title="Cancel recording"
            >
              ✕
            </button>
            <div className="flex-1 flex items-center gap-3 bg-white/5 rounded px-4">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-white font-mono">{formatRecordingTime(recordingTime)}</span>
              <div className="flex-1 flex items-center gap-1">
                {[...Array(20)].map((_, i) => (
                  <div key={i} className="w-1 bg-brand-500 rounded-full" style={{ height: `${Math.random() * 24 + 8}px` }} />
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="p-3 bg-brand-500 hover:bg-brand-600 rounded-full transition"
              title="Send voice message"
            >
              ➤
            </button>
          </>
        )}
        {showInputEmojiPicker && (
          <EmojiPicker
            onSelect={emoji => {
              setContent(prev => prev + emoji);
              setShowInputEmojiPicker(false);
            }}
            onClose={() => setShowInputEmojiPicker(false)}
          />
        )}
      </form>
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={emoji => handleReaction(showEmojiPicker, emoji)}
          onClose={() => setShowEmojiPicker(null)}
        />
      )}
      {threadMessage && (
        <div className="fixed inset-y-0 right-0 z-40">
          <ThreadPanel message={threadMessage} onClose={() => setThreadMessage(null)} />
        </div>
      )}
      {showGifPicker && (
        <GifPicker
          onSelect={handleGifSelect}
          onClose={() => setShowGifPicker(false)}
        />
      )}
      {showUserProfile && dmUserData && (
        <>
          <div 
            className="fixed inset-0 z-[60]" 
            onClick={() => setShowUserProfile(false)}
          />
          <div 
            className="fixed z-[70]" 
            style={{ 
              left: `${popoverPosition.x + 20}px`, 
              top: `${popoverPosition.y - 100}px` 
            }}
          >
            <UserProfilePopover
              user={dmUserData}
              onClose={() => setShowUserProfile(false)}
            />
          </div>
        </>
      )}
      {clickedMessageUser && (
        <>
          <div 
            className="fixed inset-0 z-[60]" 
            onClick={() => setClickedMessageUser(null)}
          />
          <div 
            className="fixed z-[70]" 
            style={{ 
              left: `${popoverPosition.x + 20}px`, 
              top: `${popoverPosition.y - 100}px` 
            }}
          >
            <UserProfilePopover
              user={clickedMessageUser}
              onClose={() => setClickedMessageUser(null)}
            />
          </div>
        </>
      )}

      {/* Schedule Message Picker */}
      {showSchedulePicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSchedulePicker(false)}>
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Schedule Message</h3>
              <button onClick={() => setShowSchedulePicker(false)} className="text-white/50 hover:text-white">
                ✕
              </button>
            </div>

            {/* Quick Schedule Options */}
            <div className="mb-4">
              <p className="text-sm text-white/70 mb-2">Quick schedule:</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => getQuickScheduleTime('afternoon')}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-sm text-white transition"
                >
                  ☀️ Today at 2 PM
                </button>
                <button
                  onClick={() => getQuickScheduleTime('morning')}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-sm text-white transition"
                >
                  🌅 Tomorrow at 9 AM
                </button>
                <button
                  onClick={() => getQuickScheduleTime('tomorrow')}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-sm text-white transition"
                >
                  📅 Tomorrow same time
                </button>
                <button
                  onClick={() => getQuickScheduleTime('monday')}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-sm text-white transition"
                >
                  📆 Monday at 9 AM
                </button>
              </div>
            </div>

            {/* Custom Date/Time */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Preview */}
            {scheduleDate && scheduleTime && (
              <div className="mb-4 p-3 bg-brand-500/10 border border-brand-500/30 rounded">
                <p className="text-sm text-white/70">Message will be sent:</p>
                <p className="text-white font-medium">
                  {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={() => setShowSchedulePicker(false)}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={scheduleMessage}
                className="flex-1"
                disabled={!scheduleDate || !scheduleTime}
              >
                Schedule
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Clips Recorder */}
      {showClips && (
        <ClipsRecorder
          channelId={channelId}
          onClose={() => setShowClips(false)}
          onSend={handleClipSend}
        />
      )}

      {/* AI Assistant */}
      {showAI && (
        <AIAssistant
          onClose={() => setShowAI(false)}
          onInsert={handleAIInsert}
        />
      )}
    </div>
  );
}
