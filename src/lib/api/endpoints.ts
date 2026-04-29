import { request, getBaseUrl, getAccessToken } from './client.ts';
import type {
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  RefreshResponse,
  MessageResponse,
  EchoResponse,
  CreateEchoRequest,
  DiaryEntry,
  Shard,
  FeedItem,
  Notification,
  EchoRelationship,
  LifeEvent,
  InfluenceBalance,
  UseInfluenceRequest,
  EchoMemory,
  Channel,
  ChannelMessage,
  SendMessageRequest,
  EditMessageRequest,
  ChangePasswordRequest,
  NotificationPreferences,
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  OracleAskRequest,
  OracleResponse,
  SearchResult,
  SearchParams,
  Conversation,
  ConversationMessage,
  CreateConversationResponse,
  ActiveConversationResponse,
  SendConversationMessageRequest,
  DataExport,
  RequestExportBody,
  SystemHealth,
  AdminReport,
  AdminUser,
  ResolveReportRequest,
  WaitlistSignupRequest,
  WaitlistSignupResponse,
  WaitlistPositionResponse,
  WaitlistCountResponse,
  FeedbackEntry,
  SubmitFeedbackRequest,
  SubmitFeedbackResponse,
  ModeratorUserItem,
  DowngradeSessionView,
  ShardDetail,
  TierLimits,
} from '../../types/api.ts';
import type {
  AdminRevokeShareTokenResponse,
  AdminShareTokenListResponse,
  AdminShareTokenSummary,
  EchoInCommonRef,
  InventoryRowResponse,
  MarketplaceItemResponse,
  MarketplacePreviewResponse,
  PublicEchoRef,
  PublicProfileResponse,
  PublicUserOgResponse,
  RelationshipResponse,
  ShareFeedItemRequest,
  ShareFeedItemResponse,
  ViralContentResponse,
} from '../../types/generated.ts';

// --- Auth ---

export const auth = {
  register: (data: RegisterRequest) =>
    request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: LoginRequest) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  refresh: (data: RefreshRequest) =>
    request<RefreshResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: () =>
    request<MessageResponse>('/auth/logout', { method: 'POST' }),
};

// --- Echoes ---

export const echoes = {
  list: () => request<EchoResponse[]>('/echoes'),

  get: (echoId: string) => request<EchoResponse>(`/echoes/${echoId}`),

  create: (data: CreateEchoRequest) =>
    request<EchoResponse>('/echoes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (echoId: string) =>
    request<MessageResponse>(`/echoes/${echoId}`, { method: 'DELETE' }),

  // Server handlers return the updated `EchoResponse` (see
  // `crates/api/src/routes/echoes.rs::hibernate_echo` and `wake_echo`
  // — both end with `Ok(Json(EchoResponse::from(&updated)))`). The
  // previous `MessageResponse` annotation was a type lie: in
  // particular it erased the server-authoritative `hibernated_at`
  // timestamp, forcing the store to fabricate one client-side where
  // clock skew could corrupt the 90-day deletion countdown.
  hibernate: (echoId: string) =>
    request<EchoResponse>(`/echoes/${echoId}/hibernate`, { method: 'POST' }),

  wake: (echoId: string) =>
    request<EchoResponse>(`/echoes/${echoId}/wake`, { method: 'POST' }),

  travel: (echoId: string, targetShardId: string) =>
    request<MessageResponse>(`/echoes/${echoId}/travel`, {
      method: 'POST',
      body: JSON.stringify({ destination_shard_id: targetShardId }),
    }),

  relationships: (echoId: string) =>
    request<EchoRelationship[]>(`/echoes/${echoId}/relationships`),

  timeline: (echoId: string, limit = 5, cursor?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return request<{ data: LifeEvent[]; next_cursor: string | null }>(
      `/echoes/${echoId}/timeline?${params.toString()}`,
    );
  },

  influence: (echoId: string) =>
    request<InfluenceBalance>(`/echoes/${echoId}/influence`),

  useInfluence: (echoId: string, data: UseInfluenceRequest) =>
    request<MessageResponse>(`/echoes/${echoId}/influence`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  memories: (echoId: string) =>
    request<EchoMemory[]>(`/echoes/${echoId}/memories`),

  diary: (echoId: string, limit = 20, cursor?: string, mood?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    if (mood) params.set('mood', mood);
    return request<{ data: DiaryEntry[]; next_cursor: string | null }>(
      `/echoes/${echoId}/diary?${params.toString()}`,
    );
  },

  narrate: async (echoId: string, entryId: string): Promise<Blob> => {
    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch(`${getBaseUrl()}/echoes/${echoId}/diary/${entryId}/narrate`, {
      method: 'POST',
      headers,
    });
    if (!resp.ok) throw new Error(await resp.text());
    return resp.blob();
  },

  /** Start async video narration. Returns cached video blob (200) or job_id (202). */
  narrateVideoStart: async (echoId: string, entryId: string): Promise<{ cached: Blob } | { jobId: string }> => {
    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch(`${getBaseUrl()}/echoes/${echoId}/diary/${entryId}/narrate/video`, {
      method: 'POST',
      headers,
    });
    if (!resp.ok) throw new Error(await resp.text());
    if (resp.status === 200) return { cached: await resp.blob() };
    const body = await resp.json();
    return { jobId: body.job_id };
  },

  /** Poll video generation status. */
  narrateVideoStatus: async (echoId: string, entryId: string, jobId: string): Promise<{ status: string; progress?: number; error?: string }> => {
    return request(`/echoes/${echoId}/diary/${entryId}/narrate/video/status/${jobId}`);
  },

  /** Fetch completed video. */
  narrateVideoResult: async (echoId: string, entryId: string, jobId: string): Promise<Blob> => {
    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch(`${getBaseUrl()}/echoes/${echoId}/diary/${entryId}/narrate/video/result/${jobId}`, {
      headers,
    });
    if (!resp.ok) throw new Error(await resp.text());
    return resp.blob();
  },

  regenerateAvatar: (echoId: string) =>
    request<EchoResponse>(`/echoes/${echoId}/avatar/regenerate`, { method: 'POST' }),

  startVoiceSession: (echoId: string) =>
    request<{
      voice_ws_url: string;
      echo_id: string;
      session_nonce: number;
      conversation_id: string;
      session_duration_seconds: number;
    }>(`/echoes/${echoId}/voice/start`, { method: 'POST' }),

  stopVoiceSession: (echoId: string, nonce?: number) =>
    request<void>(`/echoes/${echoId}/voice/stop${nonce ? `?nonce=${nonce}` : ''}`, { method: 'POST' }),

  voiceStatus: (echoId: string) =>
    request<{
      active: boolean;
      voice_ws_url: string | null;
      remaining_seconds?: number;
    }>(`/echoes/${echoId}/voice/status`),
};

// --- Shards ---

export const shards = {
  list: (params?: { type?: string; tags?: string; sort?: string }) => {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.tags) query.set('tags', params.tags);
    if (params?.sort) query.set('sort', params.sort);
    const qs = query.toString();
    return request<Shard[]>(`/shards${qs ? `?${qs}` : ''}`);
  },

  // Server handler returns `ShardDetail` (see
  // `crates/api/src/routes/shards.rs::get_shard` → `shard_to_detail`),
  // not the summary shape the list endpoint returns. The previous
  // `Shard` annotation (which aliases to `ShardSummary`) was a type
  // lie — the runtime carries `era`, `region`, `tags`,
  // `max_hibernated_echoes`, `allows_travel`, `tick_rate_modifier`,
  // and `content_locale` in addition to the summary fields. Narrowed
  // to `ShardDetail` so consumers can rely on those fields without a
  // cast and so the type system catches future drift.
  get: (shardId: string) => request<ShardDetail>(`/shards/${shardId}`),

  echoes: (shardId: string) => request<EchoResponse[]>(`/shards/${shardId}/echoes`),
};

// --- Feeds ---

type FeedPage = { data: FeedItem[]; next_cursor: string | null };

export const feeds = {
  personal: (echoId?: string, cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (echoId) params.set('echo_id', echoId);
    if (cursor) params.set('cursor', cursor);
    return request<FeedPage>(`/feeds/personal?${params.toString()}`);
  },

  social: (cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return request<FeedPage>(`/feeds/social?${params.toString()}`);
  },

  community: (limit = 20, cursor?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return request<FeedPage>(`/feeds/community?${params.toString()}`);
  },

  shard: (shardId: string, cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return request<FeedPage>(`/feeds/shard/${shardId}?${params.toString()}`);
  },

  /**
   * Create a share token for a feed item. Server materialises a
   * `ShareToken` + `ShareSnapshot` and returns the canonical
   * `https://echolabsme.com/share/{token}` URL the og-router Worker
   * resolves. Each call mints a NEW token by design (Lane H Commit 1
   * `ShareToken` is per-share-token, not per-item) — callers should
   * cache the response for the lifetime of the modal session and
   * re-call only when the user explicitly re-opens. Reference:
   * `crates/api/src/routes/feeds.rs::share_feed_item`.
   */
  share: (itemId: string, body: ShareFeedItemRequest = {}) =>
    request<ShareFeedItemResponse>(`/feeds/${itemId}/share`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// --- Notifications ---

export const notifications = {
  list: () => request<Notification[]>('/account/me/notifications'),

  markRead: (notificationId: string) =>
    request<MessageResponse>(
      `/account/me/notifications/${notificationId}/read`,
      { method: 'POST' },
    ),
};

// --- Channels ---

export const channels = {
  list: (params?: { shard_id?: string; type?: string }) => {
    const query = new URLSearchParams();
    if (params?.shard_id) query.set('shard_id', params.shard_id);
    if (params?.type) query.set('type', params.type);
    const qs = query.toString();
    return request<Channel[]>(`/channels${qs ? `?${qs}` : ''}`);
  },

  get: (channelId: string) => request<Channel>(`/channels/${channelId}`),

  messages: (channelId: string, params?: { cursor?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<{ data: ChannelMessage[]; next_cursor: string | null }>(
      `/channels/${channelId}/messages${qs ? `?${qs}` : ''}`,
    );
  },

  sendMessage: (channelId: string, data: SendMessageRequest) =>
    request<ChannelMessage>(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  editMessage: (channelId: string, messageId: string, data: EditMessageRequest) =>
    request<ChannelMessage>(`/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteMessage: (channelId: string, messageId: string) =>
    request<MessageResponse>(`/channels/${channelId}/messages/${messageId}`, {
      method: 'DELETE',
    }),

  uploadImage: async (channelId: string, file: File): Promise<ChannelMessage> => {
    const { getAccessToken, getBaseUrl } = await import('../api/client.ts');
    const form = new FormData();
    form.append('file', file);
    const resp = await fetch(`${getBaseUrl()}/channels/${channelId}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getAccessToken()}` },
      body: form,
    });
    if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
    return resp.json() as Promise<ChannelMessage>;
  },

  pollVote: (channelId: string, data: { discord_message_id: string; discord_channel_id: string; answer_id: number }) =>
    request<{ voted: boolean }>(`/channels/${channelId}/poll-vote`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createPoll: (channelId: string, data: { question: string; options: string[] }) =>
    request<{ created: boolean }>(`/channels/${channelId}/poll`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// --- Account ---

export const account = {
  getProfile: () =>
    request<import('../../types/api.ts').User>('/account/me'),

  updateProfile: (data: { display_name?: string; locale?: string }) =>
    request<{ message: string; display_name: string; locale?: string }>(
      '/account/me/profile',
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
    ),

  getPrivacy: () =>
    request<{ solo_mode: boolean; do_not_sell: boolean; analytics_opt_out: boolean }>('/account/me/privacy'),

  updatePrivacy: (data: { solo_mode?: boolean; do_not_sell?: boolean }) =>
    request<{ solo_mode: boolean; do_not_sell: boolean; analytics_opt_out: boolean; updated_at: string }>('/account/me/privacy', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  changePassword: (data: ChangePasswordRequest) =>
    request<MessageResponse>('/account/me/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getNotificationPreferences: () =>
    request<NotificationPreferences>('/account/me/notifications/preferences'),

  updateNotificationPreferences: (data: Partial<NotificationPreferences>) =>
    request<NotificationPreferences>('/account/me/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  requestExport: (data?: RequestExportBody) =>
    request<DataExport>('/account/me/story-export', {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  getExportStatus: (exportId: string) =>
    request<DataExport>(`/account/me/story-export/${exportId}`),

  downloadExport: (exportId: string) =>
    `/account/me/story-export/${exportId}/download`,

  deleteAccount: () =>
    request<MessageResponse>('/account/me', { method: 'DELETE' }),

  cancelDeletion: () =>
    request<MessageResponse>('/account/me/delete/cancel', { method: 'POST' }),

  getSessions: () =>
    request<Array<{ session_id: string; created_at: string; last_active: string; current: boolean }>>('/account/me/sessions'),

  revokeSession: (sessionId: string) =>
    request<MessageResponse>(`/account/me/sessions/${sessionId}`, { method: 'DELETE' }),

  linkDiscord: () =>
    request<{ auth_url: string }>('/account/me/discord/link', { method: 'POST' }),

  unlinkDiscord: () =>
    request<MessageResponse>('/account/me/discord/link', { method: 'DELETE' }),

  discordStatus: () =>
    request<{ linked: boolean; discord_user_id?: string; discord_username?: string }>(
      '/account/me/discord',
    ),
};

// --- API Keys ---

export const apiKeys = {
  list: () => request<ApiKey[]>('/account/me/api-keys'),

  create: (data: CreateApiKeyRequest) =>
    request<CreateApiKeyResponse>('/account/me/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  revoke: (keyId: string) =>
    request<MessageResponse>(`/account/me/api-keys/${keyId}`, { method: 'DELETE' }),
};

// --- Conversations ---

export const conversations = {
  create: (echoId: string) =>
    request<CreateConversationResponse>(`/echoes/${echoId}/conversations`, {
      method: 'POST',
    }),

  /** Find an active conversation (last message < 30min ago) or create a new one. */
  findActive: (echoId: string) =>
    request<ActiveConversationResponse>(`/echoes/${echoId}/conversations/active`),

  list: (echoId: string) =>
    request<Conversation[]>(`/echoes/${echoId}/conversations`),

  messages: (conversationId: string) =>
    request<ConversationMessage[]>(`/conversations/${conversationId}/messages`),

  sendMessage: (conversationId: string, data: SendConversationMessageRequest) =>
    request<ConversationMessage>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  saveAsDiary: (conversationId: string) =>
    request<MessageResponse>(`/conversations/${conversationId}/save`, {
      method: 'POST',
    }),
};

// --- Search ---

function buildSearchQuery(params: SearchParams): string {
  const query = new URLSearchParams();
  query.set('q', params.q);
  if (params.echo_id) query.set('echo_id', params.echo_id);
  if (params.shard_id) query.set('shard_id', params.shard_id);
  if (params.date_from) query.set('date_from', params.date_from);
  if (params.date_to) query.set('date_to', params.date_to);
  return query.toString();
}

type SearchPage = { data: SearchResult[]; next_cursor: string | null };

export const search = {
  echoes: (params: SearchParams) =>
    request<SearchPage>(`/search/echoes?${buildSearchQuery(params)}`),

  diary: (params: SearchParams) =>
    request<SearchPage>(`/search/diary?${buildSearchQuery(params)}`),

  events: (params: SearchParams) =>
    request<SearchPage>(`/search/events?${buildSearchQuery(params)}`),

  shards: (params: SearchParams) =>
    request<SearchPage>(`/search/shards?${buildSearchQuery(params)}`),

  messages: (params: SearchParams) =>
    request<SearchPage>(`/search/messages?${buildSearchQuery(params)}`),
};

// --- Oracle ---

export const oracle = {
  ask: (data: OracleAskRequest) =>
    request<OracleResponse>('/oracle/ask', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// --- Admin ---

export const admin = {
  systemHealth: () => request<SystemHealth>('/system/status'),

  reports: () => request<AdminReport[]>('/admin/reports'),

  resolveReport: (reportId: string, data: ResolveReportRequest) =>
    request<MessageResponse>(`/admin/reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  users: (params?: { q?: string }) => {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    const qs = query.toString();
    return request<AdminUser[]>(`/admin/users${qs ? `?${qs}` : ''}`);
  },

  getUser: (userId: string) => request<AdminUser>(`/admin/users/${userId}`),

  suspendUser: (userId: string) =>
    request<MessageResponse>(`/admin/users/${userId}/suspend`, { method: 'POST' }),

  unsuspendUser: (userId: string) =>
    request<MessageResponse>(`/admin/users/${userId}/unsuspend`, { method: 'POST' }),

  shards: () => request<Shard[]>('/shards'),

  feedback: () => request<FeedbackEntry[]>('/admin/feedback'),

  updateFeedbackStatus: (feedbackId: string, status: string, resolutionNotes?: string) =>
    request<FeedbackEntry>(`/admin/feedback/${feedbackId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, resolution_notes: resolutionNotes }),
    }),

  updateFeedbackPriority: (feedbackId: string, priority: string) =>
    request<FeedbackEntry>(`/admin/feedback/${feedbackId}/priority`, {
      method: 'POST',
      body: JSON.stringify({ priority }),
    }),

  createGithubIssue: (feedbackId: string) =>
    request<FeedbackEntry>(`/admin/feedback/${feedbackId}/github`, {
      method: 'POST',
    }),

  tickStatus: () => request<{ paused: boolean }>('/admin/tick/status'),
  tickPause: () => request<{ paused: boolean }>('/admin/tick/pause', { method: 'POST' }),
  tickResume: () => request<{ paused: boolean }>('/admin/tick/resume', { method: 'POST' }),
  triggerTick: () => request<{ message: string; tick_id: number }>('/system/tick', { method: 'POST' }),

  listModerators: () => request<ModeratorUserItem[]>('/admin/moderators'),

  promoteModerator: (userId: string) =>
    request<ModeratorUserItem>(`/admin/moderators/${userId}/promote`, {
      method: 'POST',
    }),

  demoteModerator: (userId: string) =>
    request<ModeratorUserItem>(`/admin/moderators/${userId}`, {
      method: 'DELETE',
    }),
};

// Lane H Commit 6 — viral-content monitoring admin surface.
// Lane H Commit 7 extends `adminShare` with token list / get / revoke.
export const adminShare = {
  listViralContent: (params?: {
    since?: string;
    min_share_count?: number;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.since) query.set('since', params.since);
    if (params?.min_share_count !== undefined)
      query.set('min_share_count', String(params.min_share_count));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const qs = query.toString();
    return request<ViralContentResponse>(
      `/admin/share/viral-content${qs ? `?${qs}` : ''}`,
    );
  },

  listTokens: (params?: {
    creator_user_id?: string;
    item_kind?: 'feed_item';
    status?: 'any' | 'active' | 'revoked' | 'expired';
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.creator_user_id) query.set('creator_user_id', params.creator_user_id);
    if (params?.item_kind) query.set('item_kind', params.item_kind);
    if (params?.status) query.set('status', params.status);
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const qs = query.toString();
    return request<AdminShareTokenListResponse>(
      `/admin/share/tokens${qs ? `?${qs}` : ''}`,
    );
  },

  getToken: (token: string) =>
    request<AdminShareTokenSummary>(`/admin/share/tokens/${token}`),

  revokeToken: (token: string, reason: string) =>
    request<AdminRevokeShareTokenResponse>(
      `/admin/share/tokens/${token}/revoke`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      },
    ),
};

export const feedback = {
  submit: (data: SubmitFeedbackRequest) =>
    request<SubmitFeedbackResponse>('/oracle/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  myFeedback: () => request<FeedbackEntry[]>('/oracle/feedback'),
};

// --- Payments ---

export interface CreatePaymentResponse {
  payment_id: string;
  checkout_url: string | null;
  qr_url: string | null;
  deeplink_url: string | null;
  payload: unknown;
}

export interface PaymentStatusResponse {
  payment_id: string;
  status: string;
  provider: string;
  amount_usd_cents: number;
  confirmed_at: string | null;
}

export const payments = {
  createNowpayments: (targetTier: string) =>
    request<CreatePaymentResponse>('/payments/nowpayments/create', {
      method: 'POST',
      body: JSON.stringify({ target_tier: targetTier }),
    }),

  createXaman: (targetTier: string) =>
    request<CreatePaymentResponse>('/payments/xaman/create', {
      method: 'POST',
      body: JSON.stringify({ target_tier: targetTier }),
    }),

  getStatus: (paymentId: string) =>
    request<PaymentStatusResponse>(`/payments/${paymentId}/status`),

  createTip: (provider: string, amountUsdCents: number, message?: string) =>
    request<CreatePaymentResponse>('/payments/tip', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        amount_usd_cents: amountUsdCents,
        message: message || undefined,
      }),
    }),
  stripeCheckout: (tier: string) =>
    request<{ checkout_url: string }>('/payments/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    }),

  stripeAddonCheckout: (addon: string) =>
    request<{ checkout_url: string }>('/payments/stripe/addon/checkout', {
      method: 'POST',
      body: JSON.stringify({ addon }),
    }),

  stripePortal: () =>
    request<{ portal_url: string }>('/payments/stripe/portal', {
      method: 'POST',
    }),
};

// --- Subscription downgrade choice flow (ME-TIER-001 v6 §2, Commit 7B backend + 7C UI) ---
//
// The Stripe webhook stages a DowngradeSession when a subscription
// downgrade reduces the user's included-shard count. The user has 24
// hours to decide per-shard: BuyAddon, UpgradeBack, or Archive. These
// 5 endpoints drive the DowngradeChoicePage state machine.
//
// Endpoint paths mirror the Rust router in
// crates/api/src/routes/subscription.rs (mounted at /subscription in
// crates/api/src/lib.rs:415).
export const subscription = {
  /**
   * Server-sourced per-tier quota snapshot (ME-MIS-001 §5.2
   * pre-confirm consent screen source of truth for the Echo-count
   * delta, plus anywhere else pricing/limits get displayed).
   *
   * Returns all five tiers in canonical low-to-high order (Free →
   * GodMode). Clients MUST NOT hardcode any of these values — the
   * whole reason this endpoint exists (PR #25) is that the server is
   * the source of truth. Handler:
   * `crates/api/src/routes/subscription.rs::get_tier_limits`.
   */
  tierLimits: () => request<TierLimits[]>('/subscription/tier-limits'),

  downgradePending: () =>
    request<DowngradeSessionView>('/subscription/downgrade/pending'),

  pickIncludedShard: (sessionId: string, shardId: string) =>
    request<DowngradeSessionView>('/subscription/downgrade/pick-included-shard', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, shard_id: shardId }),
    }),

  shardDecision: (sessionId: string, shardId: string, decision: string) =>
    request<DowngradeSessionView>('/subscription/downgrade/shard-decision', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        shard_id: shardId,
        decision,
      }),
    }),

  commit: (sessionId: string) =>
    request<DowngradeSessionView>('/subscription/downgrade/commit', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    }),

  cancel: (sessionId: string) =>
    request<DowngradeSessionView>('/subscription/downgrade/cancel', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    }),
};

export const waitlist = {
  signup: (data: WaitlistSignupRequest) =>
    request<WaitlistSignupResponse>('/waitlist', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  position: (entryId: string) =>
    request<WaitlistPositionResponse>(`/waitlist/position/${entryId}`),
  count: () => request<WaitlistCountResponse>('/waitlist/count'),
};

// --- Billing health (Lane C Commit 2 — ME-MIS-001 §5.4) ---

import type {
  BillingHealthResponse,
  AdminDunningStatesResponse,
  AdminRevenueSnapshotsResponse,
  AdminOverrideDunningStateRequest,
  AdminOverrideDunningStateResponse,
  AdminTriggerRevenueSnapshotResponse,
  CryptoBillingProvider,
} from '../../types/generated.ts';

/** Self-service billing health for the authenticated user. */
export const billing = {
  getMyHealth: () => request<BillingHealthResponse>('/me/billing-health'),
};

/** Admin-only billing health endpoints. Caller must already hold an
 *  Admin-tier bearer; non-admin requests get 403 from `AdminContext`. */
export const adminBilling = {
  listDunningStates: (limit = 50, offset = 0) =>
    request<AdminDunningStatesResponse>(
      `/admin/billing/dunning-states?limit=${limit}&offset=${offset}`,
    ),
  listRevenueSnapshots: (limit = 50, offset = 0) =>
    request<AdminRevenueSnapshotsResponse>(
      `/admin/billing/revenue-snapshots?limit=${limit}&offset=${offset}`,
    ),
  /** Force-set the dunning phase outside the policy state machine.
   *  Reference: ME-MIS-001 §5.4.6 (Lane C Commit 5). */
  overrideDunningState: (
    userId: string,
    provider: CryptoBillingProvider,
    body: AdminOverrideDunningStateRequest,
  ) =>
    request<AdminOverrideDunningStateResponse>(
      `/admin/billing/dunning-states/${userId}/${provider}/override`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  /** Manually invoke the daily revenue-snapshot generator. Idempotent
   *  within the UTC day. Reference: ME-MIS-001 §5.4.6 (Lane C Commit 5). */
  triggerRevenueSnapshot: () =>
    request<AdminTriggerRevenueSnapshotResponse>(
      '/admin/billing/revenue-snapshots/trigger',
      { method: 'POST' },
    ),
};

// --- Users (public profile surface) ---

export const users = {
  getProfile: (userId: string) =>
    request<PublicProfileResponse>(`/users/${userId}`),

  getPublic: (userId: string) =>
    request<PublicUserOgResponse>(`/public/users/${userId}`),

  listEchoes: (userId: string, params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const qs = query.toString();
    return request<PublicEchoRef[]>(
      `/users/${userId}/echoes${qs ? `?${qs}` : ''}`,
    );
  },

  // Cross-user "Echoes in common" (ME-UXF-001 §8.2). The server gates
  // this behind the same visibility rules as listEchoes — viewers
  // outside the gate get an empty array (NOT 404). Blocked-pair always
  // returns 404 to avoid leaking existence.
  echoesInCommon: (userId: string) =>
    request<EchoInCommonRef[]>(`/users/${userId}/echoes-in-common`),

  // Action affordances (ME-UXF-001 §8.2). Server endpoints live under
  // `/social/{action}/{user_id}` (POST adds the relationship, DELETE
  // removes it) — wrappers are namespaced under `users` because that's
  // the domain the page consumes them from. Mirror endpoints in
  // `crates/api/src/routes/social.rs::social_router`.
  follow: (userId: string) =>
    request<RelationshipResponse>(`/social/follow/${userId}`, { method: 'POST' }),

  unfollow: (userId: string) =>
    request<{ status: string }>(`/social/follow/${userId}`, { method: 'DELETE' }),

  block: (userId: string) =>
    request<RelationshipResponse>(`/social/block/${userId}`, { method: 'POST' }),

  unblock: (userId: string) =>
    request<{ status: string }>(`/social/block/${userId}`, { method: 'DELETE' }),

  mute: (userId: string) =>
    request<RelationshipResponse>(`/social/mute/${userId}`, { method: 'POST' }),

  unmute: (userId: string) =>
    request<{ status: string }>(`/social/mute/${userId}`, { method: 'DELETE' }),
};

// --- Social (viewer-scoped relationship lookups) ---
//
// `users.follow` / `users.block` / `users.mute` and their `un*` siblings
// are user-scoped (POST/DELETE against a specific target user_id).
// The three list endpoints below are viewer-scoped: they enumerate the
// authenticated user's OWN outbound relationships of each type. Used by
// `UserProfilePage` to derive the viewer's relationship state to the
// target on initial load. Server: `crates/api/src/routes/social.rs`.

export const social = {
  following: () =>
    request<RelationshipResponse[]>('/social/following'),
  blocked: () => request<RelationshipResponse[]>('/social/blocked'),
  muted: () => request<RelationshipResponse[]>('/social/muted'),
};

// --- Marketplace ---

type MarketplaceItemsPage = {
  data: MarketplaceItemResponse[];
  next_cursor: string | null;
};

type InventoryPage = {
  data: InventoryRowResponse[];
  next_cursor: string | null;
};

export const marketplace = {
  list: (params?: {
    cursor?: string;
    limit?: number;
    item_type?: string;
    rarity?: string;
    category?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.item_type) query.set('item_type', params.item_type);
    if (params?.rarity) query.set('rarity', params.rarity);
    if (params?.category) query.set('category', params.category);
    const qs = query.toString();
    return request<MarketplaceItemsPage>(
      `/marketplace/items${qs ? `?${qs}` : ''}`,
    );
  },

  get: (itemId: string) =>
    request<MarketplaceItemResponse>(`/marketplace/items/${itemId}`),

  preview: (itemId: string) =>
    request<MarketplacePreviewResponse>(
      `/marketplace/items/${itemId}/preview`,
    ),

  purchase: (itemId: string) =>
    request<InventoryRowResponse>('/marketplace/purchase', {
      method: 'POST',
      body: JSON.stringify({ item_id: itemId }),
    }),

  inventory: (params?: { cursor?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<InventoryPage>(
      `/marketplace/inventory${qs ? `?${qs}` : ''}`,
    );
  },

  equip: (itemId: string, equipped: boolean) =>
    request<InventoryRowResponse>(
      `/marketplace/inventory/${itemId}/equip`,
      {
        method: 'PATCH',
        body: JSON.stringify({ equipped }),
      },
    ),
};
