import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { OraclePanel } from '../src/components/OraclePanel.tsx';
import { useOracleStore } from '../src/stores/useOracleStore.ts';

// Mock the auth store
vi.mock('../src/stores/useAuthStore.ts', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ user: { subscription_tier: 'Free' } }),
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'oracle.title': 'Oracle Assistant',
        'oracle.toggle': 'Toggle Oracle assistant',
        'oracle.welcomeMessage': 'Ask me anything about Multiverse Echoes.',
        'oracle.inputPlaceholder': 'Ask the Oracle...',
        'oracle.send': 'Send message',
        'oracle.thinking': 'Oracle is thinking...',
        'oracle.clearHistory': 'Clear conversation',
        'oracle.rateLimit': '{{limit}} questions per minute',
        'oracle.error': 'The Oracle could not respond.',
        'oracle.conversation': 'Oracle conversation',
        'common.close': 'Close',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderOracle(route = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <I18nextProvider i18n={testI18n}>
        <OraclePanel />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

describe('OraclePanel', () => {
  beforeEach(() => {
    useOracleStore.setState({
      isOpen: false,
      messages: [],
      isLoading: false,
      error: null,
      context: {},
    });
  });

  it('renders the FAB button', () => {
    renderOracle();
    expect(
      screen.getByRole('button', { name: 'Toggle Oracle assistant' }),
    ).toBeInTheDocument();
  });

  it('hides on pre-auth routes', () => {
    renderOracle('/language');
    expect(
      screen.queryByRole('button', { name: 'Toggle Oracle assistant' }),
    ).not.toBeInTheDocument();
  });

  it('opens panel when FAB is clicked', () => {
    renderOracle();
    const fab = screen.getByRole('button', { name: 'Toggle Oracle assistant' });
    fireEvent.click(fab);
    expect(screen.getByRole('dialog', { name: 'Oracle Assistant' })).toBeInTheDocument();
  });

  it('shows welcome message when no messages', () => {
    useOracleStore.setState({ isOpen: true });
    renderOracle();
    expect(screen.getByText('Ask me anything about Multiverse Echoes.')).toBeInTheDocument();
  });

  it('shows rate limit info for Free tier', () => {
    useOracleStore.setState({ isOpen: true });
    renderOracle();
    expect(screen.getByText('3 questions per minute')).toBeInTheDocument();
  });

  it('closes panel when close button is clicked', () => {
    useOracleStore.setState({ isOpen: true });
    renderOracle();
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders user and oracle messages', () => {
    useOracleStore.setState({
      isOpen: true,
      messages: [
        { id: '1', role: 'user', text: 'What is a Shard?', timestamp: Date.now() },
        {
          id: '2',
          role: 'oracle',
          text: 'A Shard is a themed world.',
          deep_links: [{ label: 'Browse Shards', path: '/shards/browse' }],
          timestamp: Date.now(),
        },
      ],
    });
    renderOracle();
    expect(screen.getByText('What is a Shard?')).toBeInTheDocument();
    expect(screen.getByText('A Shard is a themed world.')).toBeInTheDocument();
    expect(screen.getByText('Browse Shards')).toBeInTheDocument();
  });

  it('disables send button when input is empty', () => {
    useOracleStore.setState({ isOpen: true });
    renderOracle();
    const sendBtn = screen.getByRole('button', { name: 'Send message' });
    expect(sendBtn).toBeDisabled();
  });

  it('shows loading indicator when isLoading', () => {
    useOracleStore.setState({ isOpen: true, isLoading: true });
    renderOracle();
    expect(screen.getByText('Oracle is thinking...')).toBeInTheDocument();
  });
});
