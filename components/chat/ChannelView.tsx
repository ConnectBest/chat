"use client";
/**
 * ChannelView Component
 * 
 * Updated to use NextAuth session and Next.js API routes for authentication.
 * All API calls now go through Next.js API routes which handle authentication
 * and forward requests to Flask backend with proper user headers.
 */
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
import { AIChatPanel } from './AIChatPanel';

interface Message { 
  id: string; 
  content: string; 
  createdAt?: string;
  created_at?: string; // Backend might use snake_case
  userId?: string;
  user_id?: string; // Backend might use snake_case
  reactions?: { emoji: string; count: number; users: string[] }[]; 
  attachments?: { name: string; size: number; type: string; url?: string }[];
  edited?: boolean;
  pinned?: boolean;
  bookmarked?: boolean;
  bookmarked_by_users?: string[]; // Array of user IDs who bookmarked this message
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
  const [attachedFiles, setAttachedFiles] = useState<Array<{name: string; size: number; type: string; url: string}>>([]);
  const [dmUserName, setDmUserName] = useState<string>('');
  const [channelName, setChannelName] = useState<string>(channelId);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
    avatar?: string;
    phone?: string;
    status: 'online' | 'away' | 'busy' | 'inmeeting' | 'offline';
    statusMessage?: string;
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const pinnedMessages = messages.filter(m => m.pinned);

  // TODO: Load users from backend for mentions
  const allUsers: Array<{ id: string; name: string; email: string; status: 'online' | 'away' | 'offline' }> = [];
  
  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Function to notify typing status
  const notifyTyping = async (isTyping: boolean) => {
    try {
      await fetch(`/api/chat/channels/${channelId}/typing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ typing: isTyping })
      });
    } catch (error) {
      // Silently fail - typing is not critical
    }
  };
  
  // Poll for typing users
  useEffect(() => {
    const fetchTypingUsers = async () => {
      try {
        const response = await fetch(`/api/chat/channels/${channelId}/typing`);
        
        if (response.ok) {
          const data = await response.json();
          setTypingUsers(data.typing_users || []);
        }
      } catch (error) {
        // Silently fail - typing is not critical
      }
    };
    
    // Fetch immediately
    fetchTypingUsers();
    
    // Poll every 5 seconds (reduced from 2 for better performance)
    const interval = setInterval(fetchTypingUsers, 5000);
    
    return () => {
      clearInterval(interval);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [channelId]);
  
  useEffect(() => {
    let mounted = true;
    
    // Fetch current user info
    const fetchCurrentUser = async () => {
      try {
        const data = await api.me();
        if (data.user && mounted) {
          setCurrentUserId(data.user.id);
        }
      } catch (error) {
        console.error('Error fetching current user:', error);
      }
    };
    
    fetchCurrentUser();
    
    // Fetch channel details to get the name
    const fetchChannelDetails = async () => {
      if (!isDM) {
        try {
          const response = await fetch('/api/chat/channels');

          if (response.ok) {
            const data = await response.json();
            const channel = data.channels?.find((c: any) => c.id === channelId || c._id === channelId);
            if (channel && mounted) {
              setChannelName(channel.name);
            }
          }
        } catch (error) {
          console.error('Error fetching channel details:', error);
        }
      }
    };

    fetchChannelDetails();
    
    if (isDM && dmUserId) {
      // Fetch DM user data from backend
      const fetchDmUser = async () => {
        try {
          const response = await fetch('/api/users');

          if (response.ok) {
            const data = await response.json();
            const user = data.users?.find((u: any) => u.id === dmUserId);
            if (user && mounted) {
              setDmUserName(user.name);
              setDmUserData({
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                status: user.status || 'offline',
                phone: user.phone,
                statusMessage: user.statusMessage
              });
            }
          }
        } catch (error) {
          console.error('Error fetching DM user:', error);
        }
      };
      
      fetchDmUser();
      
      // Load DM messages from backend
      const fetchDmMessages = async () => {
        try {
          const data = await api.listDMMessages(dmUserId);
          if (mounted) {
            // Reverse messages so oldest is at top, newest at bottom
            setMessages((data.messages || []).reverse());
            
            // Mark DM as read after a short delay to ensure messages are loaded
            if (data.dm_channel_id) {
              setTimeout(async () => {
                try {
                  await fetch(`/api/dm/channels/${data.dm_channel_id}/read`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    }
                  });
                  console.log('✅ Marked DM as read:', data.dm_channel_id);
                  window.dispatchEvent(new Event('refreshSidebar'));
                } catch (error) {
                  console.error('Failed to mark DM as read:', error);
                }
              }, 500);
            }
          }
        } catch (error) {
          console.error('Error fetching DM messages:', error);
          setMessages([]);
        }
      };
      
      fetchDmMessages();
    } else {
      api.listMessages(channelId).then(data => {
        if (mounted) {
          // Reverse messages so oldest is at top, newest at bottom
          setMessages((data.messages || []).reverse());
          
          // Mark channel as read after a short delay to ensure messages are loaded
          setTimeout(() => {
            fetch(`/api/chat/channels/${channelId}/read`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              }
            }).then(() => {
              console.log('✅ Marked channel as read:', channelId);
              // Immediately refresh sidebar to clear notification
              window.dispatchEvent(new Event('refreshSidebar'));
            }).catch(error => {
              console.error('Failed to mark channel as read:', error);
            });
          }, 500);
        }
      });
    }
    
    // TODO: Socket.io listener for typing events
    // socket.on('user-typing', ({ userId, channelId: typingChannelId }) => {
    //   if (typingChannelId === channelId) {
    //     setTypingUsers(prev => [...new Set([...prev, userId])]);
    //   }
    // });
    
    // Poll for new/updated messages every 20 seconds for better performance
    const pollInterval = setInterval(async () => {
      if (!mounted) return;
      
      try {
        if (isDM && dmUserId) {
          const data = await api.listDMMessages(dmUserId);
          if (mounted && data.messages) {
            setMessages(data.messages.reverse());
            
            // Mark DM as read after fetching new messages
            if (data.dm_channel_id) {
              try {
                await fetch(`/api/dm/channels/${data.dm_channel_id}/read`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  }
                });
                console.log('✅ Marked DM as read during polling:', data.dm_channel_id);
                window.dispatchEvent(new Event('refreshSidebar'));
              } catch (error) {
                console.error('Failed to mark DM as read during polling:', error);
              }
            }
          }
        } else {
          const data = await api.listMessages(channelId);
          if (mounted && data.messages) {
            setMessages(data.messages.reverse());
            
            // Mark channel as read after fetching new messages
            try {
              await fetch(`/api/chat/channels/${channelId}/read`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                }
              });
              console.log('✅ Marked channel as read during polling:', channelId);
              window.dispatchEvent(new Event('refreshSidebar'));
            } catch (error) {
              console.error('Failed to mark channel as read during polling:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error polling messages:', error);
      }
    }, 20000); // Poll every 20 seconds for better performance
    
    return () => { 
      mounted = false; 
      clearInterval(pollInterval);
    };
  }, [channelId, isDM, dmUserId]);

  async function send() {
    if (!content.trim() && attachedFiles.length === 0) return;
    setLoading(true);
    
    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    notifyTyping(false);
    
    try {
      // For DM, send via DM API
      if (isDM && dmUserId) {
        const { message } = await api.sendDMMessage(dmUserId, content.trim() || '📎 File attachment', attachedFiles.length > 0 ? attachedFiles : undefined);
        setMessages(prev => [...prev, { ...message, reactions: [] }]);
        setContent('');
        setAttachedFiles([]);
      } else {
        // Extract link preview
        const linkPreview = await extractLinkPreview(content);
        
        const { message } = await api.sendMessage(channelId, content.trim() || '📎 File attachment', attachedFiles.length > 0 ? attachedFiles : undefined);
        setMessages(prev => [...prev, { ...message, reactions: [], linkPreview: linkPreview || undefined }]);
        setContent('');
        setAttachedFiles([]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    } finally { setLoading(false); }
  }

  async function handleReaction(messageId: string, emoji: string) {
    if (!currentUserId) return; // Need current user ID
    setShowEmojiPicker(null); // Close picker after selection

    try {
      // Find the current message to check if user already reacted with this emoji
      const currentMessage = messages.find(m => m.id === messageId);
      const currentUserReacted = currentMessage?.reactions?.find(r =>
        r.emoji === emoji && r.users.includes(currentUserId)
      );

      let data;
      if (currentUserReacted) {
        // User already reacted with this emoji, so remove the reaction
        data = await api.removeReaction(channelId, messageId);
      } else {
        // User is adding/changing their reaction
        data = await api.addReaction(channelId, messageId, emoji);
      }

      // Update local state with backend response
      if (data.reactions) {
        setMessages(prev => prev.map(m => {
          if (m.id !== messageId) return m;
          return { ...m, reactions: data.reactions };
        }));
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
      alert('Failed to add reaction. Please try again.');
    }
  }

  async function handleFileUpload(files: File[]) {
    // Upload files to backend and store URLs
    try {
      for (const file of files) {
        const uploadResult = await api.uploadFile(file);
        // Add the uploaded file info to attachedFiles with the backend URL
        setAttachedFiles(prev => [...prev, {
          name: uploadResult.original_name,
          size: uploadResult.size,
          type: uploadResult.type,
          url: uploadResult.file_url
        }]);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Failed to upload files. Please try again.');
    }
  }

  function handleInputChange(value: string) {
    setContent(value);
    
    // Notify typing
    if (value.length > 0) {
      notifyTyping(true);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set timeout to stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        notifyTyping(false);
      }, 3000);
    } else {
      notifyTyping(false);
    }
    
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
    
    try {
      // Call backend API to update message
      const response = await fetch(`/api/chat/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: editContent.trim() })
      });

      if (!response.ok) {
        throw new Error('Failed to edit message');
      }

      const { message: updatedMessage } = await response.json();
      
      // Update local state
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, content: editContent.trim(), edited: true } : m
      ));
      
      setEditingMessageId(null);
      setEditContent('');
    } catch (error) {
      console.error('Failed to edit message:', error);
      alert('Failed to edit message. Please try again.');
    }
  }

  async function deleteMessage(messageId: string) {
    if (!confirm('Delete this message? This cannot be undone.')) return;
    
    try {
      // Call backend API to delete message
      const response = await fetch(`/api/chat/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete message');
      }

      // Update local state
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  }

  function togglePinMessage(messageId: string) {
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, pinned: !m.pinned } : m
    ));
  }

  async function toggleBookmarkMessage(messageId: string) {
    try {
      // Call backend API to toggle bookmark
      const response = await fetch(`/api/chat/messages/${messageId}/bookmark`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to toggle bookmark');
      }

      const { bookmarked } = await response.json();
      
      // Update local state - add or remove current user from bookmarked_by_users array
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        
        const bookmarked_by_users = m.bookmarked_by_users || [];
        const updatedBookmarkedBy = bookmarked 
          ? [...bookmarked_by_users, String(currentUserId)]
          : bookmarked_by_users.filter(uid => uid !== String(currentUserId));
        
        return { 
          ...m, 
          bookmarked,
          bookmarked_by_users: updatedBookmarkedBy
        };
      }));
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
      alert('Failed to bookmark message. Please try again.');
    }
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
    const interval = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
    // Store interval ID to clear later
    (window as any).recordingInterval = interval;
  }

  function stopRecording() {
    setIsRecording(false);
    clearInterval((window as any).recordingInterval);
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
    if (!currentMsg.createdAt || !prevMsg.createdAt) return false;
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
                  src={dmUserData.avatar}
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
              {pinnedMessages.map(m => {
                const pinnedDate = new Date((m.createdAt || m.created_at || ''));
                const pinnedTime = isNaN(pinnedDate.getTime()) ? 'Recent' : pinnedDate.toLocaleTimeString();
                const pinnedUserId = m.userId || m.user_id || 'unknown';
                
                return (
                  <div key={`pinned-${m.id}`} className="text-xs bg-white/5 rounded p-2">
                    <div className="text-white/50">{pinnedTime} • user {pinnedUserId}</div>
                    <div className="text-white" dangerouslySetInnerHTML={{ __html: formatMessage(m.content) }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin min-h-0" style={{ background: 'linear-gradient(to bottom, #3d4b6d, #2f3a52)' }} role="log" aria-live="polite" id="messages-container">
        {messages.map((m, index) => {
          // Normalize message properties (backend uses snake_case, frontend uses camelCase)
          const messageUserId = m.userId || m.user_id || '';
          const messageCreatedAt = m.createdAt || m.created_at || new Date().toISOString();
          
          // Determine message user - check backend user object first, then DM user data
          const messageUser = (m as any).user || (messageUserId === dmUserId && dmUserData ? dmUserData : null);
          const isCurrentUser = currentUserId && messageUserId ? String(messageUserId) === String(currentUserId) : false;
          const showDateSeparator = index > 0 ? shouldShowDateSeparator(m, messages[index - 1]) : false;
          
          // Check if current user bookmarked this message
          const isBookmarkedByCurrentUser = m.bookmarked_by_users && currentUserId 
            ? m.bookmarked_by_users.includes(String(currentUserId)) 
            : false;
          
          // Debug logging (only for first message)
          if (index === 0) {
            console.log('Message Debug:', {
              messageUserId,
              currentUserId,
              isCurrentUser,
              messageCreatedAt,
              hasUser: !!(m as any).user,
              messageUserName: messageUser?.name
            });
          }
          
          return (
            <React.Fragment key={`msg-${m.id}-${index}`}>
              {/* Date Separator */}
              {showDateSeparator && (
                <div className="flex justify-center my-4">
                  <div className="bg-dark-700/80 text-white/70 text-xs px-3 py-1 rounded-full">
                    {getDateSeparator(messageCreatedAt)}
                  </div>
                </div>
              )}

              {/* Message */}
              <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} group relative`}>
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
                      src={messageUser.avatar}
                      name={messageUser.name} 
                      status={messageUser.status} 
                      size="sm" 
                    />
                  </button>
                )}

                <div className={`max-w-[65%] ${isCurrentUser ? 'bg-blue-600 text-white' : 'bg-white/10 text-white'} rounded-lg px-3 py-2 shadow-lg relative`}>
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
                      
                      {/* Show star icon at bottom if message is bookmarked by current user */}
                      {isBookmarkedByCurrentUser && (
                        <div className="flex items-center gap-1 mt-1 pt-1 border-t border-white/10">
                          <button
                            onClick={() => toggleBookmarkMessage(m.id)}
                            className="hover:opacity-80 transition"
                            title="Remove bookmark"
                          >
                            <span className="text-yellow-400 text-sm">⭐</span>
                          </button>
                        </div>
                      )}
                      
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
                          {m.attachments.map((file, idx) => {
                            const isImage = file.type.startsWith('image/');
                            return (
                              <div key={`attachment-${m.id}-${idx}`} className="bg-white/10 rounded overflow-hidden">
                                {isImage && file.url ? (
                                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="block">
                                    <img 
                                      src={file.url} 
                                      alt={file.name}
                                      className="max-w-full max-h-64 object-contain cursor-pointer hover:opacity-90 transition"
                                      onError={(e) => {
                                        // Fallback if image fails to load
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  </a>
                                ) : null}
                                <div className="flex items-center gap-2 px-2 py-1 text-xs">
                                  <span className="text-lg">
                                    {file.type.startsWith('image/') ? '🖼️' : 
                                     file.type.includes('pdf') ? '📄' : 
                                     file.type.includes('zip') ? '📦' :
                                     file.type.includes('video') ? '🎥' :
                                     file.type.includes('audio') ? '🎵' : '📎'}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-white font-medium truncate">{file.name}</div>
                                    <div className="text-white/50 text-xs">{(file.size / 1024).toFixed(1)} KB</div>
                                  </div>
                                  {file.url && (
                                    <a 
                                      href={file.url} 
                                      download={file.name}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-brand-400 hover:text-brand-300 text-xs px-2 py-1 rounded hover:bg-white/10 transition"
                                      title="Download file"
                                    >
                                      ⬇️
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}

                  {/* Timestamp and status */}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-white/50 text-[10px]">
                      {(() => {
                        const date = new Date(messageCreatedAt);
                        if (isNaN(date.getTime())) return 'Just now';
                        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      })()}
                    </span>
                    {m.edited && <span className="text-white/40 text-[10px]">(edited)</span>}
                    {isCurrentUser && <span className="text-white/70 text-xs">✓✓</span>}
                  </div>

                  {/* Reactions */}
                  {m.reactions && m.reactions.length > 0 && (
                    <ReactionBar
                      reactions={m.reactions}
                      currentUserId={currentUserId}
                      onReact={emoji => handleReaction(m.id, emoji)}
                      onShowPicker={() => setShowEmojiPicker(m.id)}
                    />
                  )}
                </div>

                {/* Action buttons - outside message bubble */}
                <div className={`flex items-center gap-1 ${isCurrentUser ? 'order-first mr-2' : 'ml-2'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                  <button 
                    onClick={() => setShowEmojiPicker(m.id)}
                    className="text-white/40 hover:text-white text-sm p-1 rounded hover:bg-white/10 transition"
                    title="Add reaction"
                  >
                    😊
                  </button>
                  <button 
                    onClick={() => setThreadMessage(m)}
                    className="text-white/40 hover:text-white text-sm p-1 rounded hover:bg-white/10 transition"
                    title="Reply in thread"
                  >
                    💬
                  </button>
                  <button 
                    onClick={() => toggleBookmarkMessage(m.id)}
                    className={`text-sm p-1 rounded hover:bg-white/10 transition ${isBookmarkedByCurrentUser ? 'text-yellow-400' : 'text-white/40 hover:text-yellow-400'}`}
                    title={isBookmarkedByCurrentUser ? "Remove bookmark" : "Bookmark message"}
                  >
                    ⭐
                  </button>
                  {isCurrentUser && (
                    <>
                      <button 
                        onClick={() => startEditMessage(m)}
                        className="text-white/40 hover:text-white text-sm p-1 rounded hover:bg-white/10 transition"
                        title="Edit message"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => deleteMessage(m.id)}
                        className="text-white/40 hover:text-red-400 text-sm p-1 rounded hover:bg-white/10 transition"
                        title="Delete message"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {!messages.length && <div className="text-white/40 text-sm">No messages yet.</div>}
        <div ref={messagesEndRef} />
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
                placeholder="Message" 
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

      {/* AI Chat Panel */}
      <AIChatPanel
        isOpen={showAI}
        onClose={() => setShowAI(false)}
        onInsert={handleAIInsert}
      />
    </div>
  );
}
