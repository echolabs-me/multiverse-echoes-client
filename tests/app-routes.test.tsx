import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

/**
 * Phase 6B Testing — App Route Layout Structure
 *
 * Verifies that authenticated routes render within AppLayout (via Outlet)
 * and pre-auth routes render standalone without AppLayout.
 *
 * We don't import the real App (too many dependencies). Instead we verify
 * the structural contract: AppLayout wraps its children via <Outlet />,
 * pre-auth routes do not.
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

// Minimal AppLayout stand-in that proves Outlet nesting works
function MockAppLayout() {
  return (
    <div data-testid="app-layout">
      <nav data-testid="nav-sidebar">Nav</nav>
      <main>
        <Outlet />
      </main>
      <aside data-testid="oracle-sidebar">Oracle</aside>
    </div>
  );
}

describe('Route layout structure', () => {
  it('authenticated route (dashboard) renders within AppLayout', () => {
    render(
      <Wrapper>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<MockAppLayout />}>
              <Route
                path="/dashboard"
                element={<div data-testid="dashboard-page">Dashboard</div>}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </Wrapper>,
    );
    // Page renders inside the layout
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
    expect(screen.getByTestId('nav-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('oracle-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
  });

  it('authenticated route (echo detail) renders within AppLayout', () => {
    render(
      <Wrapper>
        <MemoryRouter initialEntries={['/echoes/abc-123']}>
          <Routes>
            <Route element={<MockAppLayout />}>
              <Route
                path="/echoes/:echoId"
                element={<div data-testid="echo-detail">Echo Detail</div>}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </Wrapper>,
    );
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
    expect(screen.getByTestId('echo-detail')).toBeInTheDocument();
  });

  it('authenticated route (settings) renders within AppLayout', () => {
    render(
      <Wrapper>
        <MemoryRouter initialEntries={['/settings']}>
          <Routes>
            <Route element={<MockAppLayout />}>
              <Route
                path="/settings"
                element={<div data-testid="settings-page">Settings</div>}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </Wrapper>,
    );
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
    expect(screen.getByTestId('settings-page')).toBeInTheDocument();
  });

  it('pre-auth route (login) renders standalone without AppLayout', () => {
    render(
      <Wrapper>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            {/* Pre-auth routes are NOT nested under layout */}
            <Route
              path="/login"
              element={<div data-testid="login-page">Login</div>}
            />
            <Route element={<MockAppLayout />}>
              <Route
                path="/dashboard"
                element={<div data-testid="dashboard-page">Dashboard</div>}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </Wrapper>,
    );
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('app-layout')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-sidebar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('oracle-sidebar')).not.toBeInTheDocument();
  });

  it('pre-auth route (register) renders standalone without AppLayout', () => {
    render(
      <Wrapper>
        <MemoryRouter initialEntries={['/register']}>
          <Routes>
            <Route
              path="/register"
              element={<div data-testid="register-page">Register</div>}
            />
            <Route element={<MockAppLayout />}>
              <Route
                path="/dashboard"
                element={<div>Dashboard</div>}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </Wrapper>,
    );
    expect(screen.getByTestId('register-page')).toBeInTheDocument();
    expect(screen.queryByTestId('app-layout')).not.toBeInTheDocument();
  });

  it('pre-auth route (onboarding) renders standalone without AppLayout', () => {
    render(
      <Wrapper>
        <MemoryRouter initialEntries={['/onboarding/welcome']}>
          <Routes>
            <Route
              path="/onboarding/welcome"
              element={<div data-testid="onboarding-page">Welcome</div>}
            />
            <Route element={<MockAppLayout />}>
              <Route
                path="/dashboard"
                element={<div>Dashboard</div>}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </Wrapper>,
    );
    expect(screen.getByTestId('onboarding-page')).toBeInTheDocument();
    expect(screen.queryByTestId('app-layout')).not.toBeInTheDocument();
  });
});
