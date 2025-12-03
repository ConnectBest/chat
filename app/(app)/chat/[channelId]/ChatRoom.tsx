"use client";

import { EmojiPicker } from "@/components/chat/EmojiPicker";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { useSocket } from "@/components/providers/SocketProvider";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, ChatMessageDTO } from "@/lib/api";
import { useSession } from "next-auth/react";

interface ChatRoomProps {
  channelId: string;
  currentUserId: string;
  channelName: string;
}

export default function ChatRoom({
  channelId,
  currentUserId,
  channelName,
}: ChatRoomProps) {
  const { data: session } = useSession();
  const currentUserName =
    (session?.user?.name as string | undefined) ?? "Someone";

  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // key = userId, value = userName（別人在打字）
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // 自己是否正在打字
  const [isTypingSelf, setIsTypingSelf] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { socket, connected } = useSocket();

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [messages]
  );

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  /* =======================
   *  REST: 讀取訊息
   * ======================= */

  const fetchMessages = useCallback(
    async (opts?: { silent?: boolean }) => {
      try {
        if (!opts?.silent) setLoading(true);
        setError(null);

        const { messages: data } = await api.listMessages({
          channelId,
          limit: 50,
        });

        setMessages(data);
        if (!opts?.silent) {
          setTimeout(scrollToBottom, 50);
        }
      } catch (err) {
        console.error("Failed to fetch messages", err);
        if (!opts?.silent) setError("Failed to load messages.");
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [channelId]
  );

  useEffect(() => {
    let cancelled = false;
    fetchMessages();

    const interval = setInterval(() => {
      if (!cancelled) {
        fetchMessages({ silent: true }).catch(() => {});
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchMessages]);

  /* =======================
   *  Socket: join / leave
   * ======================= */

  useEffect(() => {
    if (!socket || !connected) return;

    socket.emit("chat:join", channelId);
    console.log("[socket] join channel", channelId);

    return () => {
      socket.emit("chat:leave", channelId);
      console.log("[socket] leave channel", channelId);
    };
  }, [socket, connected, channelId]);

  /* =======================
   *  Socket: 接收 message:new
   * ======================= */

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: ChatMessageDTO) => {
      if (msg.channelId !== channelId) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;

        const tempIndex = prev.findIndex(
          (m) =>
            m.id.startsWith("temp-") &&
            m.status === "pending" &&
            m.userId === msg.userId &&
            m.content === msg.content
        );

        if (tempIndex !== -1) {
          const copy = [...prev];
          copy[tempIndex] = msg;
          return copy;
        }

        return [...prev, msg];
      });
    };

    socket.on("message:new", handleNewMessage);
    return () => {
      socket.off("message:new", handleNewMessage);
    };
  }, [socket, channelId]);

  /* =======================
   *  Socket: typing indicator（別人）
   * ======================= */

  useEffect(() => {
    if (!socket) return;

    const handleTypingUpdate = (payload: {
      channelId: string;
      userId?: string;
      userName?: string;
      typing: boolean;
    }) => {
      if (payload.channelId !== channelId) return;

      const userId = payload.userId;
      if (!userId) return;
      if (userId === currentUserId) return;

      setTypingUsers((prev) => {
        const copy = { ...prev };
        if (payload.typing) {
          copy[userId] = payload.userName ?? "Someone";
        } else {
          delete copy[userId];
        }
        return copy;
      });
    };

    socket.on("typing:update", handleTypingUpdate);
    return () => {
      socket.off("typing:update", handleTypingUpdate);
    };
  }, [socket, channelId, currentUserId]);

  /* =======================
   *  Emoji
   * ======================= */

  function handleSelectEmoji(emoji: string) {
    setInput((prev) => prev + emoji);
  }

  /* =======================
   *  Input / Typing（自己）
   * ======================= */

  const handleInputChange: React.ChangeEventHandler<HTMLTextAreaElement> = (
    e
  ) => {
    const value = e.target.value;
    setInput(value);

    if (value.trim().length > 0) {
      if (!isTypingSelf) {
        setIsTypingSelf(true);
        socket?.emit("typing:start", {
          channelId,
          userId: currentUserId,
          userName: currentUserName,
        });
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setIsTypingSelf(false);
        socket?.emit("typing:stop", {
          channelId,
          userId: currentUserId,
          userName: currentUserName,
        });
      }, 2000);
    } else {
      if (isTypingSelf) {
        setIsTypingSelf(false);
        socket?.emit("typing:stop", {
          channelId,
          userId: currentUserId,
          userName: currentUserName,
        });
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingSelf) {
        socket?.emit("typing:stop", {
          channelId,
          userId: currentUserId,
          userName: currentUserName,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =======================
   *  Send message
   * ======================= */

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;

    setSending(true);
    setInput("");

    if (isTypingSelf) {
      setIsTypingSelf(false);
      socket?.emit("typing:stop", {
        channelId,
        userId: currentUserId,
        userName: currentUserName,
      });
    }

    const tempId = `temp-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const optimistic: ChatMessageDTO = {
      id: tempId,
      channelId,
      userId: currentUserId,
      userName: "You",
      content,
      createdAt: nowIso,
      status: "pending",
    };

    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();

    try {
      const { message } = await api.sendMessage(channelId, { content });
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? message : m))
      );
    } catch (err) {
      console.error("Failed to send message", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, status: "failed" as const } : m
        )
      );
      setError("Failed to send message.");
    } finally {
      setSending(false);
      setTimeout(scrollToBottom, 50);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (
    e
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* =======================
   *  Render
   * ======================= */

  const othersTypingNames = Object.values(typingUsers);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center px-6 py-3 border-b border:white/10 bg-brand-900/80 backdrop-blur">
        <h1 className="text-lg font-semibold">
          # {channelName || channelId}
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-4 space-y-3 text-sm">
        {loading && !messages.length && (
          <div className="text-white/40">Loading messages...</div>
        )}

        {error && (
          <div className="text-xs text-red-400 bg-red-900/30 border border-red-500/40 rounded px-3 py-2 inline-block">
            {error}
          </div>
        )}

        {!loading && !messages.length && !error && (
          <div className="text-white/40">
            No messages yet. Be the first to say hi 👋
          </div>
        )}

        {sortedMessages.map((m) => {
          const isMe = m.userId === currentUserId;
          const isFailed = m.status === "failed";
          const isPending = m.status === "pending";

          const displayName =
            m.userName || (isMe ? "You" : "Unknown");

          const timeLabel = new Date(m.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={m.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`
                  max-w-xl rounded-xl px-3 py-2 text-sm
                  ${
                    isMe
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-50"
                  }
                `}
              >
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <span className="text-xs font-semibold">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-white/70">
                    {timeLabel}
                  </span>
                </div>

                <p className={isFailed ? "line-through opacity-60" : ""}>
                  {m.content}
                </p>

                <div className="mt-1 text-[10px] text-white/60 flex items-center gap-2">
                  {isPending && <span>Sending…</span>}
                  {isFailed && (
                    <span className="text-red-300">Failed</span>
                  )}
                  {m.isEdited && !isFailed && <span>(edited)</span>}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </main>

      {othersTypingNames.length > 0 && (
        <div className="px-6 pb-1">
          <TypingIndicator users={othersTypingNames} />
        </div>
      )}

      <footer className="relative border-t border-white/10 px-4 py-3 bg-brand-900/80 backdrop-blur">
        <div className="flex items-end gap-3">
          <textarea
            className="flex-1 resize-none rounded-lg bg-slate-900/70 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text:white"
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message, press Enter to send (Shift + Enter for new line)"
          />

          <button
            type="button"
            onClick={() => setShowEmojiPicker((v) => !v)}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-lg"
          >
            😀
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-white"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>

        {showEmojiPicker && (
          <div className="absolute bottom-16 right-4 z-20">
            <EmojiPicker
              onSelect={(emoji: any) => {
                const value =
                  typeof emoji === "string"
                    ? emoji
                    : emoji.native ?? "";
                if (value) {
                  handleSelectEmoji(value);
                }
              }}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        )}
      </footer>
    </div>
  );
}