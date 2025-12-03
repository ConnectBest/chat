"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { UserDirectory } from "@/components/chat/UserDirectory";
import { Avatar } from "@/components/ui/Avatar";
import { UserProfilePopover } from "@/components/ui/UserProfilePopover";
import { useSocket } from "@/components/providers/SocketProvider";
import { useSession } from "next-auth/react";

interface Channel {
  id: string;
  name: string;
  createdAt: string;
}

// 這裡的 status union 和後端 UserStatus 對齊
type UserStatus = "online" | "away" | "busy" | "inmeeting" | "offline";

interface DirectMessage {
  userId: string;
  userName: string;
  userAvatar?: string;
  status: UserStatus;
  lastMessage?: string;
}

interface SidebarUserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: UserStatus;
  statusMessage?: string;
}

export function ChannelSidebar() {
  const { data: session } = useSession();
  const currentUserId = (session?.user?.id as string) ?? "";
  const [channels, setChannels] = useState<Channel[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [open, setOpen] = useState(false);
  const [userDirOpen, setUserDirOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clickedUser, setClickedUser] = useState<SidebarUserProfile | null>(
    null
  );
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });

  const router = useRouter();
  const pathname = usePathname();

  // ⭐ 從 SocketProvider 拿到 onlineUsers
  const { onlineUsers } = useSocket();

  // --------- 第一次載入：抓 Channel + Direct Messages -----------
  useEffect(() => {
    let cancelled = false;

    async function loadSidebarData() {
      try {
        const [channelsRes, dmsRes] = await Promise.all([
          api.listChannels(),
          api.listDirectMessages(),
        ]);

        if (cancelled) return;

        if (channelsRes?.channels) {
          setChannels(channelsRes.channels);
        }

        if (dmsRes?.dms) {
          const mapped: DirectMessage[] = dmsRes.dms.map((dm: any) => ({
            userId: dm.userId,
            userName: dm.userName,
            userAvatar: dm.userAvatar,
            status: (dm.status ?? "offline") as UserStatus,
            lastMessage: dm.lastMessage,
          }));
          setDirectMessages(mapped);
        }
      } catch (err) {
        console.error("Failed to load sidebar data", err);
      }
    }

    loadSidebarData();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------- 建立 Channel ----------------
  async function createChannel() {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const { channel } = await api.createChannel(newName.trim());
      setChannels((prev) =>
        prev.find((c) => c.id === channel.id) ? prev : [...prev, channel]
      );
      setOpen(false);
      setNewName("");
      router.push(`/chat/${channel.id}`);
      setMobileMenuOpen(false);
    } finally {
      setLoading(false);
    }
  }

  // ---------------- 點選使用者建立 DM ----------------
  function handleSelectUser(user: {
    id: string;
    name: string;
    email: string;
    status: UserStatus;  // ✅ 用共用的 UserStatus union
    avatar?: string;
  }) {
    async function go() {
      try {
        // 1) 後端建立 / 取得 DM
        const { dm } = await api.createDirectMessage(user.id);

        // 2) sidebar state 裡如果沒有就加進去
        setDirectMessages((prev) => {
          if (prev.some((d) => d.userId === dm.userId)) return prev;
          return [...prev, dm];
        });

        setUserDirOpen(false);
        router.push(`/chat/dm/${dm.userId}`);
        setMobileMenuOpen(false);
      } catch (err) {
        console.error("Failed to open DM", err);
      }
    }

    void go();
  }

  // ---------------- 點擊頭像 → 顯示使用者資訊 ----------------
  async function handleAvatarClick(
    e: React.MouseEvent,
    dm: DirectMessage
  ): Promise<void> {
    e.preventDefault();
    e.stopPropagation();

    setPopoverPosition({ x: e.clientX, y: e.clientY });

    try {
      const res = await api.getUserById(dm.userId);
      const user = res.user;

      // ⭐ presence 優先，其次後端 status / DM status
      const effectiveStatus: UserStatus = onlineUsers[user.id]
        ? "online"
        : ((user.status ?? dm.status) as UserStatus);

      const profile: SidebarUserProfile = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: effectiveStatus,
        statusMessage: user.statusMessage,
      };

      setClickedUser(profile);
    } catch (err) {
      console.error("Failed to load user profile", err);

      const fallbackStatus: UserStatus = onlineUsers[dm.userId]
        ? "online"
        : dm.status;

      setClickedUser({
        id: dm.userId,
        name: dm.userName,
        email: "unknown@example.com",
        status: fallbackStatus,
      });
    }
  }

  // 小工具：把 status 轉成小標籤文字
  function renderStatusLabel(status: UserStatus) {
    if (status === "online") return "● online";
    if (status === "away") return "● away";
    if (status === "busy") return "● busy";
    if (status === "inmeeting") return "● in a meeting";
    return "";
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-brand-800 rounded-lg border border-white/20"
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? "✕" : "☰"}
      </button>

      {/* Sidebar */}
      <aside
        className={`
        border-r border-white/10 flex flex-col
        fixed md:relative inset-y-0 left-0 z-40 w-64 md:w-auto
        transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        bg-brand-900
      `}
      >
        {/* Channels Section */}
        <div className="p-4 flex items-center justify-between">
          <span className="font-semibold text-lg">Channels</span>
          <Button
            variant="ghost"
            aria-label="Create channel"
            onClick={() => setOpen(true)}
          >
            ＋
          </Button>
        </div>

        <nav className="space-y-1 px-2 overflow-y-auto max-h-[200px] scrollbar-thin">
          {channels.map((c) => (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              className={`block rounded px-3 py-2 text-sm truncate ${
                pathname === `/chat/${c.id}`
                  ? "bg-white/15"
                  : "hover:bg-white/10"
              }`}
            >
              # {c.name}
            </Link>
          ))}
          {!channels.length && (
            <div className="text-white/40 text-xs px-3">No channels</div>
          )}
        </nav>

        {/* Direct Messages Section */}
        <div className="mt-6 px-4 flex items-center justify-between">
          <span className="font-semibold text-sm text-white/80">
            Direct Messages
          </span>
          <Button
            variant="ghost"
            aria-label="New message"
            onClick={() => setUserDirOpen(true)}
            className="text-xs"
          >
            ✉️
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto space-y-1 px-2 mt-2">
          {directMessages.map((dm) => {
            // ⭐ presence 會覆蓋 DM 原本的 status
            const isOnline = !!onlineUsers[dm.userId];
            const effectiveStatus: UserStatus = isOnline
              ? "online"
              : dm.status ?? "offline";

            const statusLabel = renderStatusLabel(effectiveStatus);

            return (
              <div key={dm.userId} className="relative">
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleAvatarClick(e, dm)}
                    className="flex-shrink-0 hover:opacity-80 transition"
                  >
                    <Avatar
                      name={dm.userName}
                      size="sm"
                      status={effectiveStatus}
                    />
                  </button>

                  <Link
                    href={`/chat/dm/${dm.userId}`}
                    className={`flex-1 rounded px-3 py-2 text-sm truncate ${
                      pathname === `/chat/dm/${dm.userId}`
                        ? "bg-white/15"
                        : "hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate">{dm.userName}</div>
                      {statusLabel && (
                        <span className="text-[10px] text-emerald-300/80 whitespace-nowrap">
                          {statusLabel}
                        </span>
                      )}
                    </div>

                    {dm.lastMessage && (
                      <div className="text-xs text-white/50 truncate">
                        {dm.lastMessage}
                      </div>
                    )}
                  </Link>
                </div>
              </div>
            );
          })}

          {!directMessages.length && (
            <div className="text-white/40 text-xs px-3">
              No direct messages
            </div>
          )}
        </nav>

        {/* footer */}
        <div className="p-2 text-[10px] text-white/40 border-t border-white/10 mt-auto">
          Data loaded from API (channels & direct messages)
        </div>

        {/* Clicked User Profile */}
        {clickedUser && (
          <>
            <div
              className="fixed inset-0 z-[60]"
              onClick={() => setClickedUser(null)}
            />
            <div
              className="fixed z-[70]"
              style={{
                left: `${popoverPosition.x + 20}px`,
                top: `${popoverPosition.y - 100}px`,
              }}
            >
              <UserProfilePopover
                user={clickedUser}
                onClose={() => setClickedUser(null)}
              />
            </div>
          </>
        )}

        {/* Modals */}
        <Modal
          title="Create Channel"
          open={open}
          onClose={() => setOpen(false)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createChannel} loading={loading}>
                Create
              </Button>
            </>
          }
        >
          <label className="text-xs">Name</label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. engineering"
          />
        </Modal>

        <UserDirectory
          open={userDirOpen}
          onClose={() => setUserDirOpen(false)}
          onSelectUser={handleSelectUser}
          currentUserId={currentUserId}
        />
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
}