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
  UpdatePersonaRequest,
  Shard,
  FeedItem,
  Notification,
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

// --- Account ---

export const account = {
  getPrivacy: () =>
    request<{ solo_mode: boolean }>('/account/me/privacy'),

  updatePrivacy: (soloMode: boolean) =>
    request<MessageResponse>('/account/me/privacy', {
      method: 'PATCH',
      body: JSON.stringify({ solo_mode: soloMode }),
    }),
};
