import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DashboardPage } from '../src/pages/DashboardPage.tsx';

vi.mock('../src/stores/useEchoStore.ts', () => ({
  useEchoStore: () => ({
    echoList: [
      {
        echo_id: 'echo-1',
        name: 'Test Echo',
        current_mood: 'Curious',
        status: 'Active',
        current_tick: 42,
        current_shard_id: 'shard-1',
      },
    ],
    activeEcho: {
      echo_id: 'echo-1',
      name: 'Test Echo',
      current_mood: 'Curious',
      status: 'Active',
      current_tick: 42,
      current_shard_id: 'shard-1',
    },
    isLoading: false,
    fetchEchoes: vi.fn(),
    setActiveEcho: vi.fn(),
  }),
}));

vi.mock('../src/stores/useSystemStore.ts', () => ({
  useSystemStore: (selector: (s: unknown) => unknown) => {
    const state = { tickIntervalSeconds: 30 };
    return selector(state);
  },
}));

vi.mock('../src/stores/useAuthStore.ts', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => {
    const state = {
      user: { subscription_tier: 'Free', subscription_expires_at: null },
    };
    return selector(state);
  },
}));

vi.mock('../src/hooks/useAmbientSoundscape.ts', () => ({
  useAmbientSoundscape: vi.fn(),
}));

vi.mock('../src/hooks/useEchoWebSocket.ts', () => ({
  useEchoWebSocket: vi.fn(),
}));

vi.mock('../src/lib/api/endpoints.ts', () => ({
  echoes: {
    diary: vi.fn().mockResolvedValue([]),
    timeline: vi.fn().mockResolvedValue([]),
    relationships: vi.fn().mockResolvedValue([]),
  },
  feeds: {
    community: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../src/components/EchoPortrait3D.tsx', () => ({
  EchoPortrait3D: () => <div data-testid="portrait" />,
}));

vi.mock('../src/components/ShardEnvironment3D.tsx', () => ({
  ShardEnvironment3D: () => <div data-testid="shard-env" />,
}));

vi.mock('../src/components/TickPulse.tsx', () => ({
  TickPulse: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'dashboard.myEchoes': 'My Echoes',
        'dashboard.createNewEcho': 'Create New Echo',
        'dashboard.browseShards': 'Browse Shards',
        'dashboard.latestDiary': 'Latest Diary Entry',
        'dashboard.recentEvents': 'Recent Life Events',
        'dashboard.relationships': 'Relationships',
        'dashboard.noEchoes': 'Your multiverse is empty',
        'dashboard.noEchoesDesc': 'Create your first Echo',
        'dashboard.viewDetail': 'View detail',
        'dashboard.mood': 'Mood',
        'dashboard.tick': 'Tick {{tick}}',
        'dashboard.latestDiaryEmpty': "Your Echo's story is just beginning.",
        'dashboard.recentEventsEmpty': 'Life events will appear as your Echo experiences the world.',
        'dashboard.viewAllEvents': 'View all events',
        'dashboard.relationshipsEmpty': 'Relationships will form as your Echo meets others.',
        'dashboard.viewAllRelationships': 'View all relationships',
        'dashboard.viewAllDiary': 'View all {{count}} entries',
        'dashboard.nextTick': 'Next tick in {{seconds}}s',
        'communityFeed.title': 'Community Pulse',
        'communityFeed.empty': 'The multiverse is quiet... for now.',
        'communityFeed.newActivity': 'New activity',
        'communityFeed.justNow': 'just now',
        'communityFeed.minutesAgo': '{{count}}m ago',
        'communityFeed.hoursAgo': '{{count}}h ago',
        'communityFeed.daysAgo': '{{count}}d ago',
        'payment.renewBanner': 'Your subscription expires soon.',
        'payment.expiredBanner': 'Your subscription has expired.',
        'payment.renew': 'Renew',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('Dashboard — Life Events Section', () => {
  it('renders life events heading', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Recent Life Events')).toBeInTheDocument();
  });

  it('shows empty state when no events', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Life events will appear as your Echo experiences the world.')).toBeInTheDocument();
  });
});

describe('Dashboard — Relationships Section', () => {
  it('renders relationships heading', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Relationships')).toBeInTheDocument();
  });

  it('shows empty state when no relationships', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Relationships will form as your Echo meets others.')).toBeInTheDocument();
  });
});

describe('Dashboard — Community Pulse', () => {
  it('renders community pulse heading', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Community Pulse')).toBeInTheDocument();
  });

  it('shows empty state when no community activity', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('The multiverse is quiet... for now.')).toBeInTheDocument();
  });
});
