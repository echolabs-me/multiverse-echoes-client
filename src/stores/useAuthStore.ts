import { create } from 'zustand';
import type { User, LoginRequest, RegisterRequest, RegisterResponse } from '../types/api.ts';
import { auth } from '../lib/api/endpoints.ts';
import { setTokens, clearTokens, loadStoredTokens, configureApi } from '../lib/api/client.ts';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Configure auth failure handler
  configureApi({
    onAuthFailure: () => {
      set({ user: null, isAuthenticated: false });
    },
  });

  return {
    user: null,
    isAuthenticated: false,
    isLoading: false,

    login: async (data) => {
      set({ isLoading: true });
      try {
        const response = await auth.login(data);
        setTokens(response.access_token, response.refresh_token);
        set({ isAuthenticated: true, isLoading: false });
      } catch {
        set({ isLoading: false });
        throw new Error('Login failed');
      }
    },

    register: async (data) => {
      set({ isLoading: true });
      try {
        const response = await auth.register(data);
        // Auto-login: server returns tokens on registration.
        setTokens(response.access_token, response.refresh_token);
        set({ isAuthenticated: true, isLoading: false });
        return response;
      } catch {
        set({ isLoading: false });
        throw new Error('Registration failed');
      }
    },

    logout: async () => {
      try {
        await auth.logout();
      } catch {
        // Logout even if API call fails
      }
      clearTokens();
      set({ user: null, isAuthenticated: false });
    },

    initialize: () => {
      loadStoredTokens();
      const hasToken = !!localStorage.getItem('access_token');
      set({ isAuthenticated: hasToken });
    },
  };
});
