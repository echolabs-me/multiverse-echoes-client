import type { ApiError } from '../../types/api.ts';

function resolveBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/+$/, '');
  // Derive from current origin — works when frontend and backend share a host.
  return window.location.origin;
}

let baseUrl = resolveBaseUrl();
// Restore tokens from localStorage on module load (survives full page reloads).
let accessToken: string | null = localStorage.getItem('access_token');
let refreshToken: string | null = localStorage.getItem('refresh_token');
let onAuthFailure: (() => void) | null = null;

export function configureApi(options: {
  baseUrl?: string;
  onAuthFailure?: () => void;
}) {
  if (options.baseUrl) baseUrl = options.baseUrl;
  if (options.onAuthFailure) onAuthFailure = options.onAuthFailure;
}

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

export function loadStoredTokens() {
  accessToken = localStorage.getItem('access_token');
  refreshToken = localStorage.getItem('refresh_token');
}

export function getBaseUrl(): string {
  return baseUrl;
}

export function getAccessToken(): string | null {
  return accessToken;
}

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

// Singleflight guard for token refresh. When a burst of parallel requests
// all land on a 401 at the same time (common on page mount, where 5–6
// fetches fire in parallel), they would otherwise each fire their own
// /auth/refresh against the same refresh token. With rotation enabled
// server-side, the first succeeds and the rest see the invalidated token
// and wrongly conclude refresh has failed — triggering a spurious logout
// even though a valid new access token was issued. De-duplicating ensures
// only one refresh is in flight at a time.
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (!refreshToken) return false;
  if (refreshInFlight) return refreshInFlight;

  const promise = (async (): Promise<boolean> => {
    try {
      const response = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) return false;

      const data = (await response.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };
      accessToken = data.access_token;
      localStorage.setItem('access_token', data.access_token);
      // Server rotates the refresh token on every /auth/refresh call
      // (RFC 6819 §5.2.2.3). Persist the new one — the old one is
      // already dead server-side.
      refreshToken = data.refresh_token;
      localStorage.setItem('refresh_token', data.refresh_token);
      return true;
    } catch {
      return false;
    }
  })();

  refreshInFlight = promise;
  void promise.finally(() => {
    if (refreshInFlight === promise) refreshInFlight = null;
  });
  return promise;
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Auto-refresh on 401
  if (response.status === 401 && refreshToken) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
        credentials: 'include',
      });
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearTokens();
      onAuthFailure?.();
    }

    let errorBody: ApiError;
    try {
      errorBody = (await response.json()) as ApiError;
    } catch {
      throw new ApiRequestError(
        response.status,
        'UNKNOWN',
        `HTTP ${response.status}`,
      );
    }

    throw new ApiRequestError(
      response.status,
      errorBody.error.code,
      errorBody.error.message,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
