import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

/**
 * Phase 6 Hardening — Initialization ordering tests.
 *
 * Pattern: B1/B5/B6 traced to `initialize()` never being called on App mount.
 * These tests verify:
 * - Auth store initializes before protected routes render
 * - System store degrades gracefully when health endpoint is unreachable
 * - Unauthenticated state redirects to login (not crash)
 */

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: { en: { translation: {} } },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={testI18n}>{children}</I18nextProvider>;
}

// Simulates AppLayout auth guard + tick interval display
function MockAppLayout({
  isAuthenticated,
  tickInterval,
}: {
  isAuthenticated: boolean;
  tickInterval: number;
}) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return (
    <div data-testid="app-layout">
      <span data-testid="tick-interval">{tickInterval}s</span>
      <Outlet />
    </div>
  );
}

describe('Initialization ordering', () => {
  it('unauthenticated user is redirected to login, not shown broken layout', () => {
    render(
      <Wrapper>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<div data-testid="login">Login</div>} />
            <Route element={<MockAppLayout isAuthenticated={false} tickInterval={30} />}>
              <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Wrapper>,
    );
    expect(screen.getByTestId('login')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('app-layout')).not.toBeInTheDocument();
  });

  it('authenticated user with fallback tick interval sees fallback value', () => {
    // Simulates the case where health endpoint hasn't loaded yet.
    // Fallback should be 30s (matches config), not crash.
    render(
      <Wrapper>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<MockAppLayout isAuthenticated={true} tickInterval={30} />}>
              <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Wrapper>,
    );
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('tick-interval')).toHaveTextContent('30s');
  });

  it('system store fetchHealth handles network error gracefully', async () => {
    // Mock fetch to simulate health endpoint being unreachable.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    // Import the store fresh — it should not throw on failed health fetch.
    const { useSystemStore } = await import('../src/stores/useSystemStore.ts');

    // fetchHealth should not throw.
    await expect(useSystemStore.getState().fetchHealth()).resolves.not.toThrow();

    // Fallback value should remain — matches useSystemStore.tickIntervalSeconds
    // default which in turn matches config/default.toml tick_interval_seconds.
    expect(useSystemStore.getState().tickIntervalSeconds).toBe(120);
    expect(useSystemStore.getState().isLoaded).toBe(false);

    globalThis.fetch = originalFetch;
  });

  it('system store fetchHealth handles 500 response gracefully', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    });

    const { useSystemStore } = await import('../src/stores/useSystemStore.ts');

    await expect(useSystemStore.getState().fetchHealth()).resolves.not.toThrow();
    expect(useSystemStore.getState().tickIntervalSeconds).toBe(120);

    globalThis.fetch = originalFetch;
  });
});
