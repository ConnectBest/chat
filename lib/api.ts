/* =========================
 * Shared DTOs
 * ========================= */

export interface ChannelDTO {
  id: string;
  name: string;
  createdAt: string;
}

export interface DirectMessageSidebarItem {
  userId: string;
  userName: string;
  userAvatar?: string;
  status: "online" | "away" | "offline";
  lastMessage?: string;
}

export type UserStatus = "online" | "away" | "busy" | "inmeeting" | "offline";

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: UserStatus;
  statusMessage?: string;
  avatarUrl?: string;
}

/**
 * 單一訊息在前端用的型別
 * 注意：後端請回傳 userName / userAvatar，否則前端會顯示不了名字
 */
export interface ChatMessageDTO {
  id: string;
  channelId: string;
  userId: string;

  // 👇 這兩個是現在最重要的欄位，讓 UI 能顯示發話者
  userName: string;
  userAvatar?: string;

  content: string;
  createdAt: string;
  updatedAt?: string;

  isPinned?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;

  status?: "pending" | "sent" | "failed" | "scheduled";

  // allow extra fields from backend
  [key: string]: any;
}

/** Link preview DTO（給訊息的 linkPreview 用） */
export interface LinkPreviewDTO {
  url: string;
  title: string;
  description: string;
  image?: string;
  siteName?: string;
}

/** 簡單 health / metrics DTO，給 ops dashboard 用（可依後端實作調整） */
export interface HealthDTO {
  status: "healthy" | "degraded" | "down";
  uptime?: number;
  version?: string;
  services?: Record<string, "healthy" | "degraded" | "down">;
}

export interface MetricsDTO {
  activeConnections: number;
  totalMessages: number;
  averageLatency: number;
  errorRate: number;
  cpuUsage?: number;
  memoryUsage?: number;
  [key: string]: any;
}

/* =========================
 * Helpers
 * ========================= */

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("API error", res.status, text);
    throw new Error(text || `Request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/* =========================
 * API object
 * ========================= */

export const api = {
  /* =========================
   * Channels
   * ========================= */

  async listChannels(): Promise<{ channels: ChannelDTO[] }> {
    const res = await fetch("/api/chat/channels", {
      method: "GET",
      credentials: "include",
    });
    return handleJson(res);
  },

  async createChannel(
    name: string,
    description?: string
  ): Promise<{ channel: ChannelDTO }> {
    const res = await fetch("/api/chat/channels", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, description }),
    });
    return handleJson(res);
  },

  /* =========================
   * Direct Messages (sidebar)
   * ========================= */

  async listDirectMessages(): Promise<{ dms: DirectMessageSidebarItem[] }> {
    const res = await fetch("/api/dms", {
      method: "GET",
      credentials: "include",
    });
    return handleJson(res);
  },

  async createDirectMessage(
    userId: string
  ): Promise<{ dm: DirectMessageSidebarItem }> {
    const res = await fetch("/api/dms", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    });
    return handleJson(res);
  },

  /* =========================
   * Users
   * ========================= */

  async getUserById(userId: string): Promise<{ user: UserDTO }> {
    const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
      method: "GET",
      credentials: "include",
    });
    return handleJson(res);
  },

  // 列出可 DM / 提及的使用者
  async listUsers(params?: { q?: string }): Promise<{ users: UserDTO[] }> {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);

    const query = qs.toString();
    const url = `/api/users/list${query ? `?${query}` : ""}`;

    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
    });
    return handleJson(res);
  },

  /* =========================
   * Channel Messages
   * ========================= */

  async listMessages(params: {
    channelId: string;
    limit?: number;
    before?: string; // ISO datetime string (optional)
  }): Promise<{ messages: ChatMessageDTO[] }> {
    const { channelId, limit = 50, before } = params;

    const qs = new URLSearchParams();
    if (limit) qs.set("limit", String(limit));
    if (before) qs.set("before", before);

    const query = qs.toString();
    const url = `/api/chat/channels/${encodeURIComponent(
      channelId
    )}/messages${query ? `?${query}` : ""}`;

    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
    });

    return handleJson(res);
  },

  /**
   * 送出新訊息（支援附件、thread、link preview 等欄位）
   * 後端可選擇 ignore 多餘欄位。
   */
  async sendMessage(
    channelId: string,
    payload: {
      content: string;
      parentMessageId?: string;
      attachments?: {
        name: string;
        size: number;
        type: string;
        url?: string;
      }[];
      linkPreview?: LinkPreviewDTO | null;
      scheduledFor?: string; // 若未來要直接排程也可用
    }
  ): Promise<{ message: ChatMessageDTO }> {
    const res = await fetch(
      `/api/chat/channels/${encodeURIComponent(channelId)}/messages/send`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    return handleJson(res);
  },

  /**
   * 更新訊息內容（編輯）
   */
  async updateMessage(
    messageId: string,
    payload: { content?: string }
  ): Promise<{ message: ChatMessageDTO }> {
    const res = await fetch(
      `/api/chat/messages/${encodeURIComponent(messageId)}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    return handleJson(res);
  },

  /**
   * 刪除訊息（soft delete 或 hard delete 交給後端決定）
   */
  async deleteMessage(messageId: string): Promise<{ success: boolean }> {
    const res = await fetch(
      `/api/chat/messages/${encodeURIComponent(messageId)}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );
    return handleJson(res);
  },

  /**
   * 切換 Pin 狀態
   * 後端回傳目前 pinned 狀態即可。
   */
  async togglePinMessage(
    messageId: string
  ): Promise<{ pinned: boolean }> {
    const res = await fetch(
      `/api/chat/messages/${encodeURIComponent(messageId)}/pin`,
      {
        method: "POST",
        credentials: "include",
      }
    );
    return handleJson(res);
  },

  /**
   * 切換 Bookmark 狀態
   */
  async toggleBookmarkMessage(
    messageId: string
  ): Promise<{ bookmarked: boolean }> {
    const res = await fetch(
      `/api/chat/messages/${encodeURIComponent(messageId)}/bookmark`,
      {
        method: "POST",
        credentials: "include",
      }
    );
    return handleJson(res);
  },

  /**
   * 新增 / 更新某個使用者對訊息的 reaction
   * （實際行為：由後端決定是覆蓋舊 emoji 還是允許多個 reaction）
   */
  async reactToMessage(
    messageId: string,
    payload: { emoji: string }
  ): Promise<{ message: ChatMessageDTO }> {
    const res = await fetch(
      `/api/chat/messages/${encodeURIComponent(messageId)}/reactions`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    return handleJson(res);
  },

  /**
   * 排程訊息：對某 channel 建立 scheduled message
   * 後端會在指定時間真正寫入 messages collection。
   */
  async scheduleMessage(
    channelId: string,
    payload: {
      content: string;
      scheduledFor: string; // ISO string
      attachments?: {
        name: string;
        size: number;
        type: string;
        url?: string;
      }[];
    }
  ): Promise<{ scheduledMessageId: string }> {
    const res = await fetch(
      `/api/chat/channels/${encodeURIComponent(
        channelId
      )}/scheduled-messages`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    return handleJson(res);
  },

  /* =========================
   * Link Preview
   * ========================= */

  /**
   * 根據 URL 取得 link preview
   * 建議後端路由：GET /api/link-preview?url=...
   * 回傳格式：{ preview: LinkPreviewDTO | null }
   */
  async getLinkPreview(url: string): Promise<LinkPreviewDTO | null> {
    const qs = new URLSearchParams({ url });
    const res = await fetch(`/api/link-preview?${qs.toString()}`, {
      method: "GET",
      credentials: "include",
    });

    const data = await handleJson<{ preview: LinkPreviewDTO | null }>(res);
    return data.preview;
  },

  /* =========================
   * Ops / Monitoring
   * ========================= */

  async getHealth(): Promise<HealthDTO> {
    const res = await fetch("/api/health", {
      method: "GET",
      credentials: "include",
    });
    return handleJson(res);
  },

  async getMetrics(): Promise<MetricsDTO> {
    const res = await fetch("/api/metrics", {
      method: "GET",
      credentials: "include",
    });
    return handleJson(res);
  },
};