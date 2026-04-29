import { create } from 'zustand';
import type { User, LoginRequest, RegisterRequest, RegisterResponse } from '../types/api.ts';
import { auth, account } from '../lib/api/endpoints.ts';
import { useSystemStore } from './useSystemStore.ts';
import { setTokens, clearTokens, loadStoredTokens, configureApi } from '../lib/api/client.ts';
import { safeGetItem } from '../lib/safeStorage.ts';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  initialize: () => void;
  setUser: (user: User) => void;
  fetchProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  // Configure auth failure handler
  configureApi({
    onAuthFailure: () => {
      set({ user: null, isAuthenticated: false });
    },
  });

  // Hydrate auth state synchronously from localStorage so the first render
  // sees the correct value — prevents redirect-to-login on page refresh.
  // Every storage read routes through safeStorage so a throwing localStorage
  // (sandbox policy, disabled storage) lands the user on the login screen
  // instead of crash-looping through the ErrorBoundary.
  loadStoredTokens();
  const hasStoredToken = !!safeGetItem('access_token');

  return {
    user: null,
    isAuthenticated: hasStoredToken,
    isLoading: false,

    login: async (data) => {
      set({ isLoading: true });
      try {
        const response = await auth.login(data);
        setTokens(response.access_token, response.refresh_token);
        set({ isAuthenticated: true, isLoading: false });
        // Fetch user profile after login
        try {
          const user = await account.getProfile();
          set({ user });
        } catch {
          // Profile fetch is best-effort
        }
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
        // Fetch user profile after registration
        try {
          const user = await account.getProfile();
          set({ user });
        } catch {
          // Profile fetch is best-effort
        }
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
      const hasToken = !!safeGetItem('access_token');
      set({ isAuthenticated: hasToken });
      // Fetch profile if we have a token
      if (hasToken) {
        void account.getProfile().then((user) => set({ user })).catch(() => {});
      }
      // Fetch system config (tick interval etc.) — public endpoint, no auth needed.
      void useSystemStore.getState().fetchHealth();
    },

    setUser: (user) => set({ user }),

    fetchProfile: async () => {
      try {
        const user = await account.getProfile();
        set({ user });
      } catch {
        // Profile fetch failed
      }
    },
  };
});
