"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";

interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  status: "active" | "suspended";
  createdAt: string;
}

interface Channel {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeTab, setActiveTab] = useState<"users" | "channels">("users");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [actionType, setActionType] = useState<
    "suspend" | "activate" | "delete" | null
  >(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* =========================
   * 初始化：從後端載入 users + channels
   * ========================= */
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // 這裡對應：
        //  - GET /api/admin/users
        //  - GET /api/chat/channels
        const [usersRes, channelsRes] = await Promise.all([
          fetch("/api/admin/users", {
            method: "GET",
            credentials: "include",
          }),
          fetch("/api/chat/channels", {
            method: "GET",
            credentials: "include",
          }),
        ]);

        if (!usersRes.ok) {
          const text = await usersRes.text().catch(() => "");
          throw new Error(text || `Failed to load users (${usersRes.status})`);
        }
        if (!channelsRes.ok) {
          const text = await channelsRes.text().catch(() => "");
          throw new Error(
            text || `Failed to load channels (${channelsRes.status})`
          );
        }

        const usersJson = await usersRes.json();
        const channelsJson = await channelsRes.json();

        // 後端 /api/admin/users 建議回傳：
        // { users: [{ id, email, name, role, status, createdAt }] }
        setUsers(usersJson.users ?? []);

        // /api/chat/channels: { channels: [{ id, name, createdAt, ... }] }
        setChannels(
          (channelsJson.channels ?? []).map((ch: any) => ({
            id: ch.id,
            name: ch.name,
            memberCount: ch.memberCount ?? 0,
            createdAt: ch.createdAt,
          }))
        );
      } catch (err: any) {
        console.error("[AdminPage] failed to load data:", err);
        setError(err?.message ?? "Failed to load admin data");
      } finally {
        setLoading(false);
      }
    }

    fetchData().catch(() => {});
  }, []);

  function handleAction(user: User, action: "suspend" | "activate" | "delete") {
    setSelectedUser(user);
    setActionType(action);
    setShowConfirmModal(true);
  }

  /* =========================
   * 確認操作：呼叫後端 API
   *  - POST /api/admin/users/[id]/status  (suspend / activate)
   *  - POST /api/admin/users/[id]/delete  (delete)
   * ========================= */
  async function confirmAction() {
    if (!selectedUser || !actionType) return;

    setSaving(true);
    setError(null);

    try {
      let res: Response | null = null;

      if (actionType === "suspend" || actionType === "activate") {
        // 對應 app/api/admin/users/[id]/status/route.ts
        res = await fetch(
          `/api/admin/users/${encodeURIComponent(selectedUser.id)}/status`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: actionType }),
          }
        );
      } else if (actionType === "delete") {
        // 對應你已經實作的 app/api/admin/users/[id]/delete/route.ts
        res = await fetch(
          `/api/admin/users/${encodeURIComponent(selectedUser.id)}/delete`,
          {
            method: "POST",
            credentials: "include",
          }
        );
      }

      if (!res || !res.ok) {
        const text = res ? await res.text().catch(() => "") : "";
        throw new Error(text || `Failed to ${actionType} user`);
      }

      // 操作成功後，再重新抓一次 user list，保持畫面同步
      const usersRes = await fetch("/api/admin/users", {
        method: "GET",
        credentials: "include",
      });

      if (!usersRes.ok) {
        const text = await usersRes.text().catch(() => "");
        throw new Error(text || "Failed to refresh users list");
      }

      const usersJson = await usersRes.json();
      setUsers(usersJson.users ?? []);
    } catch (err: any) {
      console.error("[AdminPage] confirmAction error:", err);
      setError(err?.message ?? "Action failed");
    } finally {
      setSaving(false);
      setShowConfirmModal(false);
      setSelectedUser(null);
      setActionType(null);
    }
  }

  return (
    <div className="h-screen overflow-y-auto scrollbar-thin bg-gradient-to-br from-brand-900 via-brand-800 to-brand-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Admin Dashboard</h1>

        {error && (
          <div className="mb-4 rounded-md bg-red-900/40 border border-red-500/60 px-4 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              activeTab === "users"
                ? "bg-brand-600 text-white"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("channels")}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              activeTab === "channels"
                ? "bg-brand-600 text-white"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            Channels ({channels.length})
          </button>
        </div>

        {loading ? (
          <div className="text-white/70 text-sm">Loading admin data…</div>
        ) : (
          <>
            {/* Users Tab */}
            {activeTab === "users" && (
              <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                        User
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                        Email
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                        Role
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                        Joined
                      </th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-white">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-white/5 hover:bg-white/5 transition"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={user.name} size="sm" status="online" />
                            <span className="text-white font-medium">
                              {user.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-white/70">
                          {user.email}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              user.role === "admin"
                                ? "bg-purple-500/20 text-purple-300"
                                : "bg-blue-500/20 text-blue-300"
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              user.status === "active"
                                ? "bg-green-500/20 text-green-300"
                                : "bg-red-500/20 text-red-300"
                            }`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-white/70 text-sm">
                          {user.createdAt
                            ? new Date(user.createdAt).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            {user.status === "active" ? (
                              <Button
                                variant="secondary"
                                onClick={() => handleAction(user, "suspend")}
                                className="text-xs"
                                disabled={saving}
                              >
                                Suspend
                              </Button>
                            ) : (
                              <Button
                                variant="primary"
                                onClick={() => handleAction(user, "activate")}
                                className="text-xs"
                                disabled={saving}
                              >
                                Activate
                              </Button>
                            )}
                            <Button
                              variant="danger"
                              onClick={() => handleAction(user, "delete")}
                              className="text-xs"
                              disabled={saving}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Channels Tab */}
            {activeTab === "channels" && (
              <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                        Channel
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                        Members
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                        Created
                      </th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-white">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map((channel) => (
                      <tr
                        key={channel.id}
                        className="border-b border-white/5 hover:bg-white/5 transition"
                      >
                        <td className="px-6 py-4">
                          <span className="text-white font-medium">
                            #{channel.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-white/70">
                          {channel.memberCount}
                        </td>
                        <td className="px-6 py-4 text-white/70 text-sm">
                          {channel.createdAt
                            ? new Date(channel.createdAt).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <Button variant="secondary" className="text-xs">
                              View
                            </Button>
                            <Button variant="danger" className="text-xs">
                              Archive
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <p className="text-white/40 text-xs mt-6 text-center">
          Data is loaded dynamically from the backend.
        </p>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedUser && (
        <Modal
          open={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          title="Confirm Action"
          actions={
            <>
              <Button
                variant="ghost"
                onClick={() => setShowConfirmModal(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmAction} disabled={saving}>
                {saving ? "Processing..." : "Confirm"}
              </Button>
            </>
          }
        >
          <p className="text-white/70">
            Are you sure you want to {actionType} user{" "}
            <strong>{selectedUser.email}</strong>?
          </p>
        </Modal>
      )}
    </div>
  );
}