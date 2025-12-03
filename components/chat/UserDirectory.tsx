"use client";

import React, { useState, useEffect } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { api, UserDTO } from "@/lib/api";
import { useSocket } from "@/components/providers/SocketProvider";

type UserStatus = "online" | "away" | "busy" | "inmeeting" | "offline";

interface User {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  avatar?: string;
}

interface UserDirectoryProps {
  open: boolean;
  onClose: () => void;
  onSelectUser: (user: User) => void;
  currentUserId: string;
}

export function UserDirectory({
  open,
  onClose,
  onSelectUser,
  currentUserId,
}: UserDirectoryProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // ⭐ 從 SocketProvider 取得 presence
  const { onlineUsers } = useSocket();

  // 當 modal 打開時載入使用者（避免一進頁面就打 API）
  useEffect(() => {
    if (!open) return;
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadUsers() {
    try {
      setLoading(true);

      const res = await api.listUsers();
      const list = res.users ?? [];

      const mapped: User[] = list
        .filter((u) => u.id !== currentUserId) // 排除自己
        .map((u: UserDTO) => {
          // presence 優先，其次讀 profile 中存的狀態
          const isOnline = !!onlineUsers[u.id];
          const status: UserStatus = isOnline
            ? "online"
            : (u.status ?? "offline");

          return {
            id: u.id,
            name: u.name,
            email: u.email,
            status,
            avatar: u.avatarUrl ?? undefined,
          };
        });

      setUsers(mapped);
    } catch (err) {
      console.error("Failed to load users", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter((user) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q)
    );
  });

  function handleSelectUser(user: User) {
    onSelectUser(user);
    // 不在這裡關閉 modal，因為 parent（ChannelSidebar）裡有自己的 onClose 邏輯
    // 如果你想一點就關，也可以保留這兩行：
    onClose();
    setSearchQuery("");
  }

  function renderStatusBadge(status: UserStatus) {
    const base =
      "text-xs px-2 py-1 rounded capitalize";

    if (status === "online") {
      return (
        <div className={`${base} bg-green-500/20 text-green-300`}>
          online
        </div>
      );
    }
    if (status === "away") {
      return (
        <div className={`${base} bg-yellow-500/20 text-yellow-300`}>
          away
        </div>
      );
    }
    if (status === "busy") {
      return (
        <div className={`${base} bg-red-500/20 text-red-300`}>busy</div>
      );
    }
    if (status === "inmeeting") {
      return (
        <div className={`${base} bg-purple-500/20 text-purple-300`}>
          in meeting
        </div>
      );
    }
    return (
      <div className={`${base} bg-gray-500/20 text-gray-300`}>
        offline
      </div>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Start a Conversation">
      <div className="space-y-4">
        <Input
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />

        <div className="max-h-96 overflow-y-auto space-y-2 scrollbar-thin">
          {loading ? (
            <div className="text-center py-8 text-white/50">
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-white/50">
              No users found
            </div>
          ) : (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition text-left"
              >
                <Avatar
                  name={user.name}
                  src={user.avatar}
                  status={user.status}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">
                    {user.name}
                  </div>
                  <div className="text-white/50 text-sm truncate">
                    {user.email}
                  </div>
                </div>
                {renderStatusBadge(user.status)}
              </button>
            ))
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-white/10">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>

        <p className="text-[10px] text-white/40 text-center">
          Users loaded from API. Backend can customize list & filters.
        </p>
      </div>
    </Modal>
  );
}