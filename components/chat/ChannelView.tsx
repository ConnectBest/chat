"use client";
import React, { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmojiPicker, ReactionBar } from "./EmojiPicker";
import { ThreadPanel } from "./ThreadPanel";
import { FileUploader } from "./FileUploader";
import { SearchBar } from "./SearchBar";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { ChannelHeader } from "./ChannelHeader";
import { CallControls } from "./CallControls";
import { MentionAutocomplete } from "./MentionAutocomplete";
import { GifPicker } from "./GifPicker";
import { Avatar } from "@/components/ui/Avatar";
import { UserProfilePopover } from "@/components/ui/UserProfilePopover";
import { ClipsRecorder } from "./ClipsRecorder";
import { AIAssistant } from "./AIAssistant";
import { useSocket } from "@/components/providers/SocketProvider";
import type { ChatMessageDTO } from "@/lib/api";

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
  linkPreview?: {
    url: string;
    title: string;
    description: string;
    image?: string;
  };
  scheduledFor?: string;
  isScheduled?: boolean;
}

type UserStatus = "online" | "away" | "busy" | "inmeeting" | "offline";
type MentionStatus = "online" | "away" | "offline";

interface MentionUser {
  id: string;
  name: string;
  email: string;
  status: MentionStatus;
}

function mapDtoToMessage(dto: ChatMessageDTO): Message {
  return {
    id: dto.id,
    content: dto.content,
    createdAt: dto.createdAt,
    userId: dto.userId,
    reactions: dto.reactions ?? [],
    attachments: dto.attachments ?? [],
    edited: dto.isEdited,
    pinned: dto.isPinned,
    bookmarked: (dto as any).isBookmarked ?? dto.bookmarked,
    // 如果你之後在 DTO 裡加 linkPreview / gifUrl 也可以在這裡一併 map 進來
  };
}

export function ChannelView({
  channelId,
  isDM = false,
  dmUserId,
  currentUserId,
}: {
  channelId: string;
  isDM?: boolean;
  dmUserId?: string;
  currentUserId: string;
}) {
  const { socket, onlineUsers } = useSocket();  // 從 SocketProvider 拿 presence
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);
  const [threadMessage, setThreadMessage] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [dmUserName, setDmUserName] = useState<string>("");
  const [channelName, setChannelName] = useState<string>(channelId);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [showPinnedMessages, setShowPinnedMessages] = useState<boolean>(false);
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [clickedMessageUser, setClickedMessageUser] = useState<{
    id: string;
    name: string;
    email: string;
    phone?: string;
    status: "online" | "away" | "busy" | "inmeeting" | "offline";
    statusMessage?: string;
  } | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [showClips, setShowClips] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [dmUserData, setDmUserData] = useState<{
    id: string;
    name: string;
    email: string;
    phone?: string;
    status: UserStatus;
    statusMessage?: string;
  } | null>(null);

  // 從 /api/users/list 抓回來的可以 @mention 的使用者
  const [allUsers, setAllUsers] = useState<MentionUser[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  const pinnedMessages = messages.filter((m) => m.pinned);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        // DM 模式時，先抓對方 user 資料
        if (isDM && dmUserId) {
          try {
            const res = await api.getUserById(dmUserId);
            if (!mounted) return;

            const u = res.user;

            setDmUserName(u.name || u.email || "Unknown User");
            setDmUserData({
              id: u.id,
              name: u.name || "Unknown User",
              email: u.email,
              phone: u.phone,
              status: (u.status as UserStatus) || "offline",
              statusMessage: u.statusMessage,
            });
          } catch (e) {
            if (!mounted) return;
            setDmUserName("Unknown User");
            setDmUserData({
              id: dmUserId,
              name: "Unknown User",
              email: "",
              status: "offline",
            });
          }
        }

        // ✅ 不分 DM / Channel，一律從後端拿訊息（MongoDB）
        const data = await api.listMessages({ channelId });
        if (!mounted) return;
        setMessages(data.messages);
      } catch (err) {
        console.error("Failed to load messages", err);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [channelId, isDM, dmUserId]);

  useEffect(() => {
    let cancelled = false;

    async function loadUsersForMentions() {
      try {
        // 這裡假設你之後會在 lib/api.ts 實作 api.listUsers()
        const res = await api.listUsers();
        if (cancelled) return;

        const users: MentionUser[] = res.users.map((u: any) => {
          const rawStatus: UserStatus = (u.status as UserStatus) || "offline";

          const status: MentionStatus =
            rawStatus === "online"
              ? "online"
              : rawStatus === "away"
              ? "away"
              : "offline"; // 其他 busy / inmeeting 一律視為 offline

          return {
            id: u.id,
            name: u.name || u.email || "Unknown User",
            email: u.email,
            status,
          };
        });
        setAllUsers(users);
      } catch (err) {
        console.error("Failed to load users for mentions", err);
      }
    }

    loadUsersForMentions();

    return () => {
      cancelled = true;
    };
  }, []);

// 當 socket 收到新訊息時，及時加入到目前 channel 的 messages
useEffect(() => {
  if (!socket) return;

  function handleIncomingMessage(dto: ChatMessageDTO) {
    // 只處理目前這個 channel / DM 的訊息
    if (dto.channelId !== channelId) return;

    setMessages((prev) => {
      // 已經有這個 messageId 就不要重複插入（避免自己送的訊息被加兩次）
      if (prev.some((m) => m.id === dto.id)) {
        return prev;
      }
      const mapped = mapDtoToMessage(dto);
      return [...prev, mapped];
    });
  }

  // ✅ 事件名稱就統一用 "chat:message"
  socket.on("chat:message", handleIncomingMessage);

  return () => {
    socket.off("chat:message", handleIncomingMessage);
  };
}, [socket, channelId]);

  // 進入某個 channel / DM 時，加入對應的 socket room
  useEffect(() => {
    if (!socket) return;

    socket.emit("chat:join", channelId);

    return () => {
      socket.emit("chat:leave", channelId);
    };
  }, [socket, channelId]);


  async function send() {
    if (!content.trim() && attachedFiles.length === 0) return;
    setLoading(true);

    try {
      const attachments = attachedFiles.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
      }));

      // 從文字中找網址
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = content.match(urlRegex);
      let linkPreview = null;

      if (urls && urls.length > 0) {
        try {
          linkPreview = await api.getLinkPreview(urls[0]);
        } catch (e) {
          console.warn("Link preview failed, continue without it", e);
        }
      }

      const { message } = await api.sendMessage(channelId, {
        content: content.trim() || "📎 File attachment",
        attachments,
        linkPreview,
      });

    // 1️⃣ 自己這邊先更新 UI
    setMessages((prev) => [
      ...prev,
      {
        ...message,
        reactions: message.reactions ?? [],
        attachments: message.attachments ?? attachments,
        linkPreview: message.linkPreview ?? linkPreview ?? undefined,
      },
    ]);
    setContent("");
    setAttachedFiles([]);

    // 2️⃣ 再把這則訊息廣播給「同一個 channel room」裡的其他人
    if (socket) {
      socket.emit("chat:message", message); // 直接丟後端回來的 ChatMessageDTO
    }
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setLoading(false);
    }
  }

    // ✅ 加上 API 呼叫，但不再傳 userId（後端從 session 判斷）
  async function handleReaction(messageId: string, emoji: string) {
    const userId = currentUserId; // 用 props 傳進來的 currentUserId
    setShowEmojiPicker(null);

    // 先在前端樂觀更新
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;

        let reactions = [...(m.reactions || [])];

        // 先移除這個 user 原本的 reaction
        reactions = reactions
          .map((r) => {
            const users = r.users.filter((u) => u !== userId);
            return { ...r, users, count: users.length };
          })
          .filter((r) => r.count > 0);

        // 再加上新的 reaction
        const existingIndex = reactions.findIndex((r) => r.emoji === emoji);
        if (existingIndex >= 0) {
          const r = reactions[existingIndex];
          reactions[existingIndex] = {
            ...r,
            count: r.count + 1,
            users: [...r.users, userId],
          };
        } else {
          reactions.push({ emoji, count: 1, users: [userId] });
        }

        return { ...m, reactions };
      })
    );

    // 再把結果丟給後端
    try {
      await api.reactToMessage(messageId, { emoji });
    } catch (e) {
      console.error("Failed to send reaction", e);
      // 這裡目前先不 rollback，之後有需要再補
    }
  }

  async function handleFileUpload(files: File[]) {
    setAttachedFiles((prev) => [...prev, ...files]);
  }

  function handleInputChange(value: string) {
    setContent(value);

    // Check for @ mentions
    const lastAtSymbol = value.lastIndexOf("@");
    if (lastAtSymbol !== -1 && lastAtSymbol === value.length - 1) {
      setShowMentionAutocomplete(true);
      setMentionQuery("");
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setMentionPosition({ top: rect.top - 250, left: rect.left });
      }
    } else if (lastAtSymbol !== -1) {
      const afterAt = value.substring(lastAtSymbol + 1);
      if (!afterAt.includes(" ") && afterAt.length > 0) {
        setShowMentionAutocomplete(true);
        setMentionQuery(afterAt);
        if (inputRef.current) {
          const rect = inputRef.current.getBoundingClientRect();
          setMentionPosition({ top: rect.top - 250, left: rect.left });
        }
      } else if (afterAt.includes(" ")) {
        setShowMentionAutocomplete(false);
      }
    } else {
      setShowMentionAutocomplete(false);
    }

    // TODO: Emit typing event via socket
    // socket.emit('typing', { channelId, userId: currentUser.id });
  }

  function handleMentionSelect(user: MentionUser) {
    const lastAtSymbol = content.lastIndexOf("@");
    const beforeAt = content.substring(0, lastAtSymbol);
    setContent(beforeAt + "@" + user.name + " ");
    setShowMentionAutocomplete(false);
    inputRef.current?.focus();
  }

  function handleGifSelect(gifUrl: string) {
    const newMessage: Message = {
      id: Date.now().toString(),
      content: content || "",
      createdAt: new Date().toISOString(),
      userId: currentUserId,
      gifUrl,
    };
    setMessages((prev) => [...prev, newMessage]);
    setContent("");
    setShowGifPicker(false);
  }

  async function extractLinkPreview(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = text.match(urlRegex);
  if (!urls || urls.length === 0) return null;

  const url = urls[0];

  try {
    const preview = await api.getLinkPreview(url); // <-- 呼叫後端
    return preview; // 已符合前端需要的格式
  } catch (err) {
    console.warn("Link preview failed:", err);
    return null;
  }
}

  function startEditMessage(message: Message) {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  }

  function cancelEdit() {
    setEditingMessageId(null);
    setEditContent("");
  }

  async function saveEdit(messageId: string) {
    if (!editContent.trim()) return;

    try {
      const { message } = await api.updateMessage(messageId, {
        content: editContent.trim(),
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: message.content, edited: true }
            : m
        )
      );
      setEditingMessageId(null);
      setEditContent("");
    } catch (err) {
      console.error("Failed to update message", err);
    }
  }

  async function deleteMessage(messageId: string) {
    if (!confirm("Delete this message? This cannot be undone.")) return;

    try {
      await api.deleteMessage(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error("Failed to delete message", err);
    }
  }

  async function togglePinMessage(messageId: string) {
    try {
      const { pinned } = await api.togglePinMessage(messageId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, pinned } : m
        )
      );
    } catch (err) {
      console.error("Failed to toggle pin", err);
    }
  }

  async function toggleBookmarkMessage(messageId: string) {
    try {
      const { bookmarked } = await api.toggleBookmarkMessage(messageId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, bookmarked } : m
        )
      );
    } catch (err) {
      console.error("Failed to toggle bookmark", err);
    }
  }

  function formatMessage(text: string) {
    let formatted = text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(
        /`(.+?)`/g,
        '<code class="px-1 py-0.5 bg-white/10 rounded text-sm">$1</code>'
      )
      .replace(/~~(.+?)~~/g, "<del>$1</del>")
      .replace(
        /@(\w+)/g,
        '<span class="text-brand-400 font-medium">@$1</span>'
      )
      .replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" class="text-brand-400 hover:underline">$1</a>'
      );
    return formatted;
  }

  function insertFormatting(format: "bold" | "italic" | "code" | "strike") {
    const formats = {
      bold: "**",
      italic: "*",
      code: "`",
      strike: "~~",
    };
    const marker = formats[format];
    setContent((prev) => prev + marker + "text" + marker);
  }

  function startRecording() {
    setIsRecording(true);
    setRecordingTime(0);
    const interval = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
    (window as any).recordingInterval = interval;
  }

  function stopRecording() {
    setIsRecording(false);
    clearInterval((window as any).recordingInterval);
    const audioMessage: Message = {
      id: Date.now().toString(),
      content: `🎤 Voice message (${recordingTime}s)`,
      createdAt: new Date().toISOString(),
      userId: currentUserId,
    };
    setMessages((prev) => [...prev, audioMessage]);
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
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function getDateSeparator(date: string) {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.toDateString() === today.toDateString()) {
      return "Today";
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      const dayName = messageDate.toLocaleDateString("en-US", {
        weekday: "long",
      });
      const isWithinWeek =
        (today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24) < 7;
      if (isWithinWeek) {
        return dayName;
      }
      return messageDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    }
  }

  function shouldShowDateSeparator(
    currentMsg: Message,
    prevMsg: Message | undefined
  ) {
    if (!prevMsg) return true;
    const currentDate = new Date(currentMsg.createdAt).toDateString();
    const prevDate = new Date(prevMsg.createdAt).toDateString();
    return currentDate !== prevDate;
  }

  function openSchedulePicker() {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().slice(0, 5);
    setScheduleDate(dateStr);
    setScheduleTime(timeStr);
    setShowSchedulePicker(true);
  }

  async function scheduleMessage() {
    if (!content.trim() || !scheduleDate || !scheduleTime) return;

    const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
    const now = new Date();

    if (scheduledDateTime <= now) {
      alert("Please select a future date and time");
      return;
    }

    try {
      // 建議建立 /api/channels/[id]/scheduled-messages 之類的 endpoint
      await api.scheduleMessage(channelId, {
        content: content.trim(),
        scheduledFor: scheduledDateTime.toISOString(),
        attachments: attachedFiles.map((f) => ({
          name: f.name,
          size: f.size,
          type: f.type,
        })),
      });

      console.log("Message scheduled for:", scheduledDateTime);
      alert(`Message scheduled for ${scheduledDateTime.toLocaleString()}`);

      setContent("");
      setAttachedFiles([]);
      setShowSchedulePicker(false);
      setScheduleDate("");
      setScheduleTime("");
    } catch (err) {
      console.error("Failed to schedule message", err);
      alert("Failed to schedule message. Please try again.");
    }
  }

  function getQuickScheduleTime(
    option: "morning" | "afternoon" | "tomorrow" | "monday"
  ) {
    const now = new Date();
    let scheduledTime = new Date();

    switch (option) {
      case "morning":
        scheduledTime.setDate(now.getDate() + 1);
        scheduledTime.setHours(9, 0, 0, 0);
        break;
      case "afternoon":
        scheduledTime.setHours(14, 0, 0, 0);
        if (scheduledTime <= now) {
          scheduledTime.setDate(now.getDate() + 1);
        }
        break;
      case "tomorrow":
        scheduledTime.setDate(now.getDate() + 1);
        break;
      case "monday":
        const daysUntilMonday = ((8 - now.getDay()) % 7) || 7;
        scheduledTime.setDate(now.getDate() + daysUntilMonday);
        scheduledTime.setHours(9, 0, 0, 0);
        break;
    }

    setScheduleDate(scheduledTime.toISOString().split("T")[0]);
    setScheduleTime(scheduledTime.toTimeString().slice(0, 5));
  }

  function handleClipSend(
    clipUrl: string,
    clipType: "video" | "audio",
    duration: number
  ) {
    const clipMessage: Message = {
      id: Date.now().toString(),
      content: `${
        clipType === "video" ? "📹" : "🎤"
      } ${clipType === "video" ? "Video" : "Audio"} Clip (${Math.floor(
        duration / 60
      )}:${(duration % 60).toString().padStart(2, "0")})`,
      createdAt: new Date().toISOString(),
      userId: currentUserId,
    };
    setMessages((prev) => [...prev, clipMessage]);
    // TODO: upload clip & POST /api/messages
  }

  function handleAIInsert(text: string) {
    setContent(text);
  }

  // 實際要給 UI 使用的 DM 狀態：
  const dmStatus: UserStatus =
    dmUserId && onlineUsers[dmUserId] === "online"
      ? "online"
      : dmUserData?.status ?? "offline";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
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
                  status={dmStatus}   // 用 socket + DB 合成後的狀態
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
            console.log("Channel updated:", name, members);
          }}
        />
      )}

      {/* Search Bar */}
      <div className="flex-shrink-0 p-3 border-b border-white/10">
        <SearchBar
          onResultClick={(result) => console.log("Navigate to:", result)}
        />
      </div>

      {/* Pinned Messages */}
      {pinnedMessages.length > 0 && (
        <div className="flex-shrink-0 bg-brand-500/20 border-b border-brand-500/30 p-2 px-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowPinnedMessages(!showPinnedMessages)}
              className="text-sm text-brand-300 hover:text-brand-200 flex items-center gap-2"
            >
              📌 {pinnedMessages.length} Pinned Message
              {pinnedMessages.length > 1 ? "s" : ""}
              <span className="text-xs">
                {showPinnedMessages ? "▲" : "▼"}
              </span>
            </button>
          </div>
          {showPinnedMessages && (
            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto scrollbar-thin">
              {pinnedMessages.map((m) => (
                <div
                  key={`pinned-${m.id}`}
                  className="text-xs bg-white/5 rounded p-2"
                >
                  <div className="text-white/50">
                    {new Date(m.createdAt).toLocaleTimeString()} • user{" "}
                    {m.userId}
                  </div>
                  <div
                    className="text-white"
                    dangerouslySetInnerHTML={{
                      __html: formatMessage(m.content),
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin min-h-0"
        style={{ background: "linear-gradient(to bottom, #3d4b6d, #2f3a52)" }}
        role="log"
        aria-live="polite"
      >
        {messages.map((m, index) => {
          const baseUser =
            m.userId === dmUserId && dmUserData ? dmUserData : null;

          // 如果是 DM 對象，就把 status 改成現在的 dmStatus
          const messageUser = baseUser ? { ...baseUser, status: dmStatus } : null;

          const isCurrentUser = m.userId === currentUserId;
          const showSeparator = shouldShowDateSeparator(
            m,
            messages[index - 1]
          );

          return (
            <React.Fragment key={`msg-${m.id}-${index}`}>
              {showSeparator && (
                <div className="flex justify-center my-4">
                  <div className="bg-dark-700/80 text-white/70 text-xs px-3 py-1 rounded-full">
                    {getDateSeparator(m.createdAt)}
                  </div>
                </div>
              )}

              <div
                className={`flex ${
                  isCurrentUser ? "justify-end" : "justify-start"
                } group`}
              >
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

                <div
                  className={`max-w-[65%] ${
                    isCurrentUser ? "bg-brand-600/90" : "bg-white/10"
                  } rounded-lg px-3 py-2 shadow-lg relative group`}
                >
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
                  <div
                    className={`absolute top-2 opacity-0 group-hover:opacity-100 flex gap-1 ${
                      isCurrentUser ? "left-[-160px]" : "right-[-160px]"
                    }`}
                  >
                    <button
                      onClick={() => setThreadMessage(m)}
                      className="text-white/50 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition"
                      title="Reply in thread"
                    >
                      💬
                    </button>
                    <button
                      onClick={() => toggleBookmarkMessage(m.id)}
                      className={`text-xs px-2 py-1 rounded hover:bg-white/10 transition ${
                        m.bookmarked
                          ? "text-yellow-400"
                          : "text-white/50 hover:text-yellow-400"
                      }`}
                      title={m.bookmarked ? "Remove bookmark" : "Bookmark message"}
                    >
                      ⭐
                    </button>
                    {m.pinned && (
                      <span className="text-brand-400 text-xs px-2 py-1">
                        📌
                      </span>
                    )}
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
                        onChange={(e) => setEditContent(e.target.value)}
                        placeholder="Edit message..."
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => saveEdit(m.id)}
                          className="text-xs"
                        >
                          Save
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={cancelEdit}
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className="text-white text-sm"
                        dangerouslySetInnerHTML={{
                          __html: formatMessage(m.content),
                        }}
                      />
                      {m.gifUrl && (
                        <div className="mt-2">
                          <img
                            src={m.gifUrl}
                            alt="GIF"
                            className="rounded max-w-full max-h-48 object-cover"
                          />
                        </div>
                      )}
                      {m.linkPreview && (
                        <div className="mt-2 border border-white/20 rounded overflow-hidden">
                          {m.linkPreview.image && (
                            <img
                              src={m.linkPreview.image}
                              alt={m.linkPreview.title}
                              className="w-full h-24 object-cover"
                            />
                          )}
                          <div className="p-2 bg-white/5">
                            <div className="text-white font-medium text-xs truncate">
                              {m.linkPreview.title}
                            </div>
                            <div className="text-white/50 text-xs mt-1 line-clamp-2">
                              {m.linkPreview.description}
                            </div>
                          </div>
                        </div>
                      )}
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {m.attachments.map((file, idx) => (
                            <div
                              key={`attachment-${m.id}-${idx}`}
                              className="flex items-center gap-2 bg-white/10 rounded px-2 py-1 text-xs"
                            >
                              <span className="text-lg">
                                {file.type.startsWith("image/")
                                  ? "🖼️"
                                  : file.type.includes("pdf")
                                  ? "📄"
                                  : file.type.includes("zip")
                                  ? "📦"
                                  : "📎"}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-white font-medium truncate">
                                  {file.name}
                                </div>
                                <div className="text-white/50 text-xs">
                                  {(file.size / 1024).toFixed(1)} KB
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Timestamp & status */}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-white/50 text-[10px]">
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {m.edited && (
                      <span className="text-white/40 text-[10px]">
                        (edited)
                      </span>
                    )}
                    {isCurrentUser && (
                      <span className="text-blue-400 text-xs">✓✓</span>
                    )}
                  </div>

                  {/* Reactions */}
                  {m.reactions && m.reactions.length > 0 && (
                    <ReactionBar
                      reactions={m.reactions}
                      onReact={(emoji) => handleReaction(m.id, emoji)}
                      onShowPicker={() => setShowEmojiPicker(m.id)}
                    />
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {!messages.length && (
          <div className="text-white/40 text-sm">No messages yet.</div>
        )}
      </div>

      {/* Typing indicator */}
      <TypingIndicator users={typingUsers} />

      {/* Attached files preview */}
      {attachedFiles.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-t border-white/10 bg-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/70 text-sm font-medium">
              {attachedFiles.length} file(s) attached
            </span>
            <button
              onClick={() => setAttachedFiles([])}
              className="text-white/50 hover:text-white text-xs"
            >
              Clear all
            </button>
          </div>
          <div className="space-y-1">
            {attachedFiles.map((file, idx) => (
              <div
                key={`file-${file.name}-${idx}`}
                className="flex items-center gap-2 bg-white/10 rounded px-2 py-1.5 text-sm"
              >
                <span className="text-lg">
                  {file.type.startsWith("image/")
                    ? "🖼️"
                    : file.type.includes("pdf")
                    ? "📄"
                    : file.type.includes("zip")
                    ? "📦"
                    : "📎"}
                </span>
                <span className="text-white flex-1 truncate">
                  {file.name}
                </span>
                <span className="text-white/50 text-xs">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
                <button
                  onClick={() =>
                    setAttachedFiles((prev) =>
                      prev.filter((_, i) => i !== idx)
                    )
                  }
                  className="text-white/50 hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
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

            {/* Message Input */}
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={content}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={`Message #${channelId}`}
                aria-label="Message input"
                className="pr-12 animate-pulse-cursor"
              />
              <button
                type="button"
                onClick={() =>
                  setShowInputEmojiPicker(!showInputEmojiPicker)
                }
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
                <Button type="submit" loading={loading}>
                  Send
                </Button>
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
              <span className="text-white font-mono">
                {formatRecordingTime(recordingTime)}
              </span>
              <div className="flex-1 flex items-center gap-1">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-brand-500 rounded-full"
                    style={{ height: `${Math.random() * 24 + 8}px` }}
                  />
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
            onSelect={(emoji) => {
              setContent((prev) => prev + emoji);
              setShowInputEmojiPicker(false);
            }}
            onClose={() => setShowInputEmojiPicker(false)}
          />
        )}
      </form>

      {/* Floating emoji picker for reactions */}
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={(emoji) => handleReaction(showEmojiPicker, emoji)}
          onClose={() => setShowEmojiPicker(null)}
        />
      )}

      {/* Thread panel */}
      {threadMessage && (
        <div className="fixed inset-y-0 right-0 z-40">
          <ThreadPanel
            message={threadMessage}
            onClose={() => setThreadMessage(null)}
          />
        </div>
      )}

      {/* GIF picker */}
      {showGifPicker && (
        <GifPicker
          onSelect={handleGifSelect}
          onClose={() => setShowGifPicker(false)}
        />
      )}

      {/* DM header profile popover */}
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
              top: `${popoverPosition.y - 100}px`,
            }}
          >
            <UserProfilePopover
              user={{ ...dmUserData, status: dmStatus }}   // 套用修正後狀態
              onClose={() => setShowUserProfile(false)}
            />
          </div>
        </>
      )}

      {/* Message avatar popover */}
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
              top: `${popoverPosition.y - 100}px`,
            }}
          >
            <UserProfilePopover
              user={clickedMessageUser}
              onClose={() => setClickedMessageUser(null)}
            />
          </div>
        </>
      )}

      {/* Schedule picker */}
      {showSchedulePicker && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowSchedulePicker(false)}
        >
          <div
            className="bg-dark-800 rounded-lg p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Schedule Message
              </h3>
              <button
                onClick={() => setShowSchedulePicker(false)}
                className="text-white/50 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-white/70 mb-2">Quick schedule:</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => getQuickScheduleTime("afternoon")}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-sm text-white transition"
                >
                  ☀️ Today at 2 PM
                </button>
                <button
                  onClick={() => getQuickScheduleTime("morning")}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-sm text-white transition"
                >
                  🌅 Tomorrow at 9 AM
                </button>
                <button
                  onClick={() => getQuickScheduleTime("tomorrow")}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-sm text-white transition"
                >
                  📅 Tomorrow same time
                </button>
                <button
                  onClick={() => getQuickScheduleTime("monday")}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-sm text-white transition"
                >
                  📆 Monday at 9 AM
                </button>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {scheduleDate && scheduleTime && (
              <div className="mb-4 p-3 bg-brand-500/10 border border-brand-500/30 rounded">
                <p className="text-sm text-white/70">Message will be sent:</p>
                <p className="text-white font-medium">
                  {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString(
                    "en-US",
                    {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }
                  )}
                </p>
              </div>
            )}

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
        <AIAssistant onClose={() => setShowAI(false)} onInsert={handleAIInsert} />
      )}
    </div>
  );
}