/**
 * Standalone HTTP client for the Multiverse Echoes API.
 *
 * Works in any JavaScript runtime (browser, Node.js, Deno, Bun) that
 * provides the Fetch API.
 *
 * @example
 * ```ts
 * import { createClient } from '@echolabs/multiverse-echoes';
 *
 * const client = createClient({ baseUrl: 'https://api.echolabsme.com' });
 * await client.login({ email: 'user@example.com', password: 'secret' });
 * const echoes = await client.echoes.list();
 * ```
 */

import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshResponse,
  MessageResponse,
  EchoResponse,
  CreateEchoRequest,
  UpdatePersonaRequest,
  EchoRelationship,
  InfluenceBalance,
  UseInfluenceRequest,
  EchoMemory,
  Shard,
  FeedItem,
  Notification,
  Channel,
  ChannelMessage,
  Conversation,
  ConversationMessage,
  SearchResult,
  SearchParams,
  OracleAskRequest,
  OracleResponse,
  DataExport,
  RequestExportBody,
  WaitlistSignupRequest,
  WaitlistSignupResponse,
  WaitlistPositionResponse,
  WaitlistCountResponse,
  ApiError,
} from './types.js';

/** Error thrown when an API request fails. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

export interface ClientOptions {
  /** Base URL of the Multiverse Echoes API (e.g. `https://api.echolabsme.com`). */
  baseUrl: string;
  /** Optional API key for key-based auth instead of JWT. */
  apiKey?: string;
}

interface TokenState {
  accessToken: string | null;
  refreshToken: string | null;
}

async function request<T>(
  baseUrl: string,
  path: string,
  tokens: TokenState,
  apiKey: string | undefined,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  } else if (tokens.accessToken) {
    headers['Authorization'] = `Bearer ${tokens.accessToken}`;
  }

  let response = await fetch(`${baseUrl}${path}`, { ...options, headers });

  // Auto-refresh on 401 (JWT only)
  if (response.status === 401 && tokens.refreshToken && !apiKey) {
    const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: tokens.refreshToken }),
    });

    if (refreshRes.ok) {
      const data = (await refreshRes.json()) as RefreshResponse;
      tokens.accessToken = data.access_token;
      headers['Authorization'] = `Bearer ${data.access_token}`;
      response = await fetch(`${baseUrl}${path}`, { ...options, headers });
    }
  }

  if (!response.ok) {
    let errorBody: ApiError;
    try {
      errorBody = (await response.json()) as ApiError;
    } catch {
      throw new ApiRequestError(response.status, 'UNKNOWN', `HTTP ${response.status}`);
    }
    throw new ApiRequestError(response.status, errorBody.error.code, errorBody.error.message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** Create a typed API client for the Multiverse Echoes engine. */
export function createClient(options: ClientOptions) {
  const { baseUrl, apiKey } = options;
  const tokens: TokenState = { accessToken: null, refreshToken: null };

  const req = <T>(path: string, init?: RequestInit) =>
    request<T>(baseUrl, path, tokens, apiKey, init);

  return {
    /** Set JWT tokens directly (e.g. restored from storage). */
    setTokens(access: string, refresh: string) {
      tokens.accessToken = access;
      tokens.refreshToken = refresh;
    },

    /** Log in and store tokens. */
    async login(data: LoginRequest): Promise<LoginResponse> {
      const res = await req<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      tokens.accessToken = res.access_token;
      tokens.refreshToken = res.refresh_token;
      return res;
    },

    /** Register a new account. */
    register: (data: RegisterRequest) =>
      req<RegisterResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

    /** Log out and clear tokens. */
    async logout(): Promise<MessageResponse> {
      const res = await req<MessageResponse>('/auth/logout', { method: 'POST' });
      tokens.accessToken = null;
      tokens.refreshToken = null;
      return res;
    },

    echoes: {
      list: () => req<EchoResponse[]>('/echoes'),
      get: (echoId: string) => req<EchoResponse>(`/echoes/${echoId}`),
      create: (data: CreateEchoRequest) =>
        req<EchoResponse>('/echoes', { method: 'POST', body: JSON.stringify(data) }),
      updatePersona: (echoId: string, data: UpdatePersonaRequest) =>
        req<EchoResponse>(`/echoes/${echoId}/persona`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (echoId: string) =>
        req<MessageResponse>(`/echoes/${echoId}`, { method: 'DELETE' }),
      hibernate: (echoId: string) =>
        req<MessageResponse>(`/echoes/${echoId}/hibernate`, { method: 'POST' }),
      wake: (echoId: string) =>
        req<MessageResponse>(`/echoes/${echoId}/wake`, { method: 'POST' }),
      travel: (echoId: string, targetShardId: string) =>
        req<MessageResponse>(`/echoes/${echoId}/travel`, {
          method: 'POST',
          body: JSON.stringify({ target_shard_id: targetShardId }),
        }),
      relationships: (echoId: string) =>
        req<EchoRelationship[]>(`/echoes/${echoId}/relationships`),
      influence: (echoId: string) =>
        req<InfluenceBalance>(`/echoes/${echoId}/influence`),
      useInfluence: (echoId: string, data: UseInfluenceRequest) =>
        req<MessageResponse>(`/echoes/${echoId}/influence`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      memories: (echoId: string) =>
        req<EchoMemory[]>(`/echoes/${echoId}/memories`),
      rename: (echoId: string, name: string) =>
        req<EchoResponse>(`/echoes/${echoId}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    },

    shards: {
      list: (params?: { type?: string; tags?: string; sort?: string }) =>
        req<Shard[]>(`/shards${buildQuery(params ?? {})}`),
      get: (shardId: string) => req<Shard>(`/shards/${shardId}`),
      echoes: (shardId: string) => req<EchoResponse[]>(`/shards/${shardId}/echoes`),
    },

    feeds: {
      personal: (echoId?: string) =>
        req<FeedItem[]>(`/feeds/personal${echoId ? `?echo_id=${echoId}` : ''}`),
      social: () => req<FeedItem[]>('/feeds/social'),
      shard: (shardId: string) => req<FeedItem[]>(`/feeds/shard/${shardId}`),
    },

    notifications: {
      list: () => req<Notification[]>('/account/me/notifications'),
      markRead: (notificationId: string) =>
        req<MessageResponse>(`/account/me/notifications/${notificationId}/read`, { method: 'POST' }),
    },

    channels: {
      list: (params?: { shard_id?: string; type?: string }) =>
        req<Channel[]>(`/channels${buildQuery(params ?? {})}`),
      get: (channelId: string) => req<Channel>(`/channels/${channelId}`),
      messages: (channelId: string, params?: { before?: string; limit?: number }) =>
        req<ChannelMessage[]>(`/channels/${channelId}/messages${buildQuery({
          before: params?.before,
          limit: params?.limit?.toString(),
        })}`),
      sendMessage: (channelId: string, body: string) =>
        req<ChannelMessage>(`/channels/${channelId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ body }),
        }),
    },

    conversations: {
      create: (echoId: string) =>
        req<Conversation>(`/echoes/${echoId}/conversations`, { method: 'POST' }),
      messages: (conversationId: string) =>
        req<ConversationMessage[]>(`/conversations/${conversationId}/messages`),
      sendMessage: (conversationId: string, content: string) =>
        req<ConversationMessage>(`/conversations/${conversationId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content }),
        }),
      saveAsDiary: (conversationId: string) =>
        req<MessageResponse>(`/conversations/${conversationId}/save`, { method: 'POST' }),
    },

    search: {
      echoes: (params: SearchParams) =>
        req<SearchResult[]>(`/search/echoes${buildQuery(params as unknown as Record<string, string | undefined>)}`),
      diary: (params: SearchParams) =>
        req<SearchResult[]>(`/search/diary${buildQuery(params as unknown as Record<string, string | undefined>)}`),
      events: (params: SearchParams) =>
        req<SearchResult[]>(`/search/events${buildQuery(params as unknown as Record<string, string | undefined>)}`),
      shards: (params: SearchParams) =>
        req<SearchResult[]>(`/search/shards${buildQuery(params as unknown as Record<string, string | undefined>)}`),
      messages: (params: SearchParams) =>
        req<SearchResult[]>(`/search/messages${buildQuery(params as unknown as Record<string, string | undefined>)}`),
    },

    oracle: {
      ask: (data: OracleAskRequest) =>
        req<OracleResponse>('/oracle/ask', { method: 'POST', body: JSON.stringify(data) }),
    },

    exports: {
      request: (data: RequestExportBody) =>
        req<DataExport>('/account/me/export', { method: 'POST', body: JSON.stringify(data) }),
      status: (exportId: string) =>
        req<DataExport>(`/account/me/export/${exportId}`),
    },

    waitlist: {
      signup: (data: WaitlistSignupRequest) =>
        req<WaitlistSignupResponse>('/waitlist', { method: 'POST', body: JSON.stringify(data) }),
      position: (entryId: string) =>
        req<WaitlistPositionResponse>(`/waitlist/position/${entryId}`),
      count: () => req<WaitlistCountResponse>('/waitlist/count'),
    },
  };
}

/** TypeScript type for the client returned by `createClient`. */
export type MultiverseEchoesClient = ReturnType<typeof createClient>;
