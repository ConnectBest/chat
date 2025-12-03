"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [name, setName] = useState("");
  const [status, setStatus] = useState("Available");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const [initialLoaded, setInitialLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ---- 2FA 狀態 ----
  const [enabling2FA, setEnabling2FA] = useState(false);

  // ---- Change password modal 狀態 ----
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [changePwError, setChangePwError] = useState<string | null>(null);
  const [changePwSuccess, setChangePwSuccess] = useState<string | null>(null);

  // 1) 先用 session 填預設，再從後端 /api/users/me 把完整 profile 拉回來覆蓋
  useEffect(() => {
    if (!session?.user) return;

    // 為了讓 TS 知道不會變動，先存一份
    const baseUser = session.user;

    // 先用 session 當 fallback
    setName(baseUser.name || "");
    setAvatarUrl(baseUser.image || "");

    async function fetchProfile() {
      try {
        setError(null);
        const res = await fetch("/api/users/me", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          console.warn("[ProfilePage] /api/users/me GET failed:", res.status);
          setInitialLoaded(true);
          return;
        }

        const json = await res.json();
        const user = json.user ?? json;

        setName(
          user.displayName ??
            user.name ??
            baseUser.name ??
            ""
        );
        setStatus(user.status ?? "Available");
        setAvatarUrl(
          user.avatarUrl ??
            user.image ??
            baseUser.image ??
            ""
        );
      } catch (err) {
        console.error("[ProfilePage] fetchProfile error:", err);
        setError("Failed to load profile from server.");
      } finally {
        setInitialLoaded(true);
      }
    }

    fetchProfile().catch(() => {});
  }, [session]);

  // 2) 儲存：真正呼叫 PUT /api/users/me
  async function handleSave() {
    if (!session?.user) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/users/me", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          status,
          avatarUrl,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          text || `Failed to update profile (status ${res.status})`
        );
      }

      const json = await res.json().catch(() => null);
      console.log("[ProfilePage] updated user:", json);

      setSuccess("Profile updated successfully.");
    } catch (err: any) {
      console.error("[ProfilePage] handleSave error:", err);
      setError(err?.message ?? "Failed to save profile.");
    } finally {
      setLoading(false);
    }
  }

  // 3) Enable 2FA：呼叫 POST /api/users/me/enable-2fa
  async function handleEnable2FA() {
    if (!session?.user) return;

    setEnabling2FA(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/users/me/enable-2fa", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          text || `Failed to enable 2FA (status ${res.status})`
        );
      }

      const data = await res.json().catch(() => null);

      if (data?.alreadyEnabled) {
        setSuccess("Two-factor authentication is already enabled for your account.");
      } else {
        setSuccess("Two-factor authentication has been enabled.");
      }
    } catch (err: any) {
      console.error("[ProfilePage] handleEnable2FA error:", err);
      setError(err?.message ?? "Failed to enable two-factor authentication.");
    } finally {
      setEnabling2FA(false);
    }
  }

  // 4) Change Password: 呼叫 POST /api/users/me/change-password
  async function handleChangePasswordSubmit() {
    if (!session?.user) return;

    setChangingPassword(true);
    setChangePwError(null);
    setChangePwSuccess(null);

    if (!currentPassword || !newPassword) {
      setChangePwError("Current password and new password are required.");
      setChangingPassword(false);
      return;
    }

    if (newPassword.length < 8) {
      setChangePwError("New password must be at least 8 characters.");
      setChangingPassword(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePwError("New password and confirmation do not match.");
      setChangingPassword(false);
      return;
    }

    try {
      const res = await fetch("/api/users/me/change-password", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          text || `Failed to change password (status ${res.status})`
        );
      }

      setChangePwSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("[ProfilePage] handleChangePasswordSubmit error:", err);
      setChangePwError(err?.message ?? "Failed to change password.");
    } finally {
      setChangingPassword(false);
    }
  }

  function closeChangePasswordModal() {
    if (changingPassword) return; // 正在送出時避免關閉
    setShowChangePassword(false);
    setChangePwError(null);
    setChangePwSuccess(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  // -------- loading / 未登入畫面 --------
  if (sessionStatus === "loading" || (!initialLoaded && session?.user)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-600 to-brand-800 p-8 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-white text-xl">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-600 to-brand-800 p-8 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-white text-xl">Not logged in</p>
          <Button onClick={() => router.push("/login")}>Go to Login</Button>
        </div>
      </div>
    );
  }

  // -------- 主畫面 --------
  return (
    <div className="h-screen overflow-y-auto scrollbar-thin bg-gradient-to-br from-brand-600 to-brand-800 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-white">Profile Settings</h1>

        {/* error / success 提示 */}
        {error && (
          <div className="rounded-md bg-red-900/40 border border-red-500/60 px-4 py-2 text-sm text-red-100">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-md bg-emerald-900/40 border border-emerald-500/60 px-4 py-2 text-sm text-emerald-100">
            {success}
          </div>
        )}

        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 space-y-6">
          <div className="flex items-center gap-4">
            <Avatar src={avatarUrl} name={name} size="lg" status="online" />
            <div>
              <h2 className="text-lg font-semibold text-white">
                {session.user.email}
              </h2>
              <p className="text-sm text-white/70">
                Role: {(session.user as any).role || "user"}
              </p>
              {(session.user as any).phone && (
                <p className="text-sm text-white/70">
                  Phone: {(session.user as any).phone}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white mb-2">
                Display Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm text-white mb-2">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
              >
                <option value="Available">🟢 Available</option>
                <option value="Busy">🔴 Busy</option>
                <option value="Away">🟡 Away</option>
                <option value="Offline">⚫ Offline</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-white mb-2">
                Avatar URL
              </label>
              <Input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-white/50 mt-1">
                File upload can later be wired to a dedicated avatar upload
                endpoint.
              </p>
            </div>

            <div>
              <label className="block text-sm text-white mb-2">
                Notification Preferences
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-white">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span>Desktop notifications</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-white">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span>Email notifications</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-white">
                  <input type="checkbox" className="rounded" />
                  <span>Message preview in notifications</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm text-white mb-2">Timezone</label>
              <Input
                value={Intl.DateTimeFormat().resolvedOptions().timeZone}
                disabled
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} loading={loading}>
              Save Changes
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.history.back()}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>

        {/* Account actions */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4">
            Account Actions
          </h3>
          <div className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowChangePassword(true)}
            >
              Change Password
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={handleEnable2FA}
              disabled={enabling2FA}
            >
              {enabling2FA ? "Enabling 2FA..." : "Enable 2FA"}
            </Button>
            <Button variant="danger" className="w-full justify-start">
              Delete Account
            </Button>
          </div>
          <p className="text-xs text-white/50 mt-4">
            Change password is wired to /api/users/me/change-password.  
            2FA & delete account can be connected to dedicated endpoints later.
          </p>
        </div>
      </div>

      {/* Change Password Modal */}
      {showChangePassword && (
        <Modal
          open={showChangePassword}
          onClose={closeChangePasswordModal}
          title="Change Password"
          actions={
            <>
              <Button
                variant="ghost"
                onClick={closeChangePasswordModal}
                disabled={changingPassword}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleChangePasswordSubmit}
                disabled={changingPassword}
              >
                {changingPassword ? "Updating..." : "Update Password"}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {changePwError && (
              <div className="rounded-md bg-red-900/40 border border-red-500/60 px-3 py-2 text-xs text-red-100">
                {changePwError}
              </div>
            )}
            {changePwSuccess && (
              <div className="rounded-md bg-emerald-900/40 border border-emerald-500/60 px-3 py-2 text-xs text-emerald-100">
                {changePwSuccess}
              </div>
            )}

            <div>
              <label className="block text-sm text-white mb-1">
                Current Password
              </label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>

            <div>
              <label className="block text-sm text-white mb-1">
                New Password
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label className="block text-sm text-white mb-1">
                Confirm New Password
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}