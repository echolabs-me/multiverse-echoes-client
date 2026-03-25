import type { ApiError } from '../../types/api.ts';

const DEFAULT_BASE_URL = 'http://localhost:8080';

let baseUrl = DEFAULT_BASE_URL;
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

async function tryRefreshToken(): Promise<boolean> {
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) return false;

    const data = (await response.json()) as { access_token: string; expires_in: number };
    accessToken = data.access_token;
    localStorage.setItem('access_token', data.access_token);
    return true;
  } catch {
    return false;
  }
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
  });

  // Auto-refresh on 401
  if (response.status === 401 && refreshToken) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
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
