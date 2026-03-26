import { request } from './client.ts';
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
  UpdatePersonaRequest,
  Shard,
  FeedItem,
  Notification,
  EchoRelationship,
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
  SendConversationMessageRequest,
  DataExport,
  RequestExportBody,
  SystemHealth,
  AdminAlert,
  AdminReport,
  AdminUser,
  AdminShard,
  ResolveReportRequest,
  WaitlistSignupRequest,
  WaitlistSignupResponse,
  WaitlistPositionResponse,
  WaitlistCountResponse,
} from '../../types/api.ts';

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

  updatePersona: (echoId: string, data: UpdatePersonaRequest) =>
    request<EchoResponse>(`/echoes/${echoId}/persona`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (echoId: string) =>
    request<MessageResponse>(`/echoes/${echoId}`, { method: 'DELETE' }),

  hibernate: (echoId: string) =>
    request<MessageResponse>(`/echoes/${echoId}/hibernate`, { method: 'POST' }),

  wake: (echoId: string) =>
    request<MessageResponse>(`/echoes/${echoId}/wake`, { method: 'POST' }),

  travel: (echoId: string, targetShardId: string) =>
    request<MessageResponse>(`/echoes/${echoId}/travel`, {
      method: 'POST',
      body: JSON.stringify({ target_shard_id: targetShardId }),
    }),

  relationships: (echoId: string) =>
    request<EchoRelationship[]>(`/echoes/${echoId}/relationships`),

  influence: (echoId: string) =>
    request<InfluenceBalance>(`/echoes/${echoId}/influence`),

  useInfluence: (echoId: string, data: UseInfluenceRequest) =>
    request<MessageResponse>(`/echoes/${echoId}/influence`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  memories: (echoId: string) =>
    request<EchoMemory[]>(`/echoes/${echoId}/memories`),

  diary: (echoId: string, limit = 20, offset = 0) =>
    request<DiaryEntry[]>(`/echoes/${echoId}/diary?limit=${limit}&offset=${offset}`),

  rename: (echoId: string, name: string) =>
    request<EchoResponse>(`/echoes/${echoId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
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

  get: (shardId: string) => request<Shard>(`/shards/${shardId}`),

  echoes: (shardId: string) => request<EchoResponse[]>(`/shards/${shardId}/echoes`),
};

// --- Feeds ---

export const feeds = {
  personal: (echoId?: string) => {
    const qs = echoId ? `?echo_id=${echoId}` : '';
    return request<FeedItem[]>(`/feeds/personal${qs}`);
  },

  social: () => request<FeedItem[]>('/feeds/social'),

  shard: (shardId: string) =>
    request<FeedItem[]>(`/feeds/shard/${shardId}`),
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

  messages: (channelId: string, params?: { before?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.before) query.set('before', params.before);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<ChannelMessage[]>(`/channels/${channelId}/messages${qs ? `?${qs}` : ''}`);
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
};

// --- Account ---

export const account = {
  getProfile: () =>
    request<import('../../types/api.ts').User>('/account/me'),

  updateProfile: (data: { display_name?: string }) =>
    request<{ message: string; display_name: string }>('/account/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

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
    request<DataExport>('/account/me/export', {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  getExportStatus: (exportId: string) =>
    request<DataExport>(`/account/me/export/${exportId}`),

  deleteAccount: () =>
    request<MessageResponse>('/account/me', { method: 'DELETE' }),

  cancelDeletion: () =>
    request<MessageResponse>('/account/me/cancel-deletion', { method: 'POST' }),

  getSessions: () =>
    request<Array<{ session_id: string; created_at: string; last_active: string; current: boolean }>>('/account/me/sessions'),

  revokeSession: (sessionId: string) =>
    request<MessageResponse>(`/account/me/sessions/${sessionId}`, { method: 'DELETE' }),

  linkDiscord: () =>
    request<{ auth_url: string }>('/account/me/discord/link', { method: 'POST' }),

  unlinkDiscord: () =>
    request<MessageResponse>('/account/me/discord/link', { method: 'DELETE' }),
};

// --- API Keys ---

export const apiKeys = {
  list: () => request<ApiKey[]>('/keys'),

  create: (data: CreateApiKeyRequest) =>
    request<CreateApiKeyResponse>('/keys', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  revoke: (keyId: string) =>
    request<MessageResponse>(`/keys/${keyId}`, { method: 'DELETE' }),
};

// --- Conversations ---

export const conversations = {
  create: (echoId: string) =>
    request<CreateConversationResponse>(`/echoes/${echoId}/conversations`, {
      method: 'POST',
    }),

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

export const search = {
  echoes: (params: SearchParams) =>
    request<SearchResult[]>(`/search/echoes?${buildSearchQuery(params)}`),

  diary: (params: SearchParams) =>
    request<SearchResult[]>(`/search/diary?${buildSearchQuery(params)}`),

  events: (params: SearchParams) =>
    request<SearchResult[]>(`/search/events?${buildSearchQuery(params)}`),

  shards: (params: SearchParams) =>
    request<SearchResult[]>(`/search/shards?${buildSearchQuery(params)}`),

  messages: (params: SearchParams) =>
    request<SearchResult[]>(`/search/messages?${buildSearchQuery(params)}`),
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

  alerts: () => request<AdminAlert[]>('/admin/alerts'),

  reports: () => request<AdminReport[]>('/admin/reports'),

  resolveReport: (reportId: string, data: ResolveReportRequest) =>
    request<MessageResponse>(`/admin/reports/${reportId}/resolve`, {
      method: 'POST',
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

  shards: () => request<AdminShard[]>('/admin/shards'),

  pauseTicks: () => request<MessageResponse>('/system/pause', { method: 'POST' }),

  resumeTicks: () => request<MessageResponse>('/system/resume', { method: 'POST' }),

  triggerBackup: () => request<MessageResponse>('/system/backup', { method: 'POST' }),
};

// --- Reports ---

export const reports = {
  create: (data: { target_type: string; target_id: string; reason: string; details?: string }) =>
    request<MessageResponse>('/reports', {
      method: 'POST',
      body: JSON.stringify(data),
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
