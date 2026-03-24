import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EchoConversationPage } from '../src/pages/EchoConversationPage.tsx';

// Mock stores — Free tier (shows gate)
vi.mock('../src/stores/index.ts', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ user: { display_name: 'Test', subscription_tier: 'Free' } }),
  useEchoStore: () => ({
    activeEcho: { echo_id: 'e1', name: 'Test Echo', current_mood: 'curious' },
    fetchEcho: vi.fn(),
  }),
}));

// Mock API
vi.mock('../src/lib/api/endpoints.ts', () => ({
  conversations: {
    create: vi.fn().mockResolvedValue({ conversation_id: 'c1' }),
    messages: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn().mockResolvedValue({
      message_id: 'm1',
      conversation_id: 'c1',
      role: 'echo',
      content: 'Hello!',
      created_at: new Date().toISOString(),
    }),
    saveAsDiary: vi.fn().mockResolvedValue({ message: 'saved' }),
  },
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'common.back': 'Back',
        'common.loading': 'Loading...',
        'conversation.echo': 'Echo',
        'conversation.mood': 'Feeling {{mood}}',
        'conversation.inputPlaceholder': 'Say something to your Echo...',
        'conversation.send': 'Send message',
        'conversation.save': 'Save conversation',
        'conversation.saved': 'Saved',
        'conversation.messages': 'Conversation messages',
        'conversation.startPrompt': 'Start a conversation with your Echo.',
        'conversation.messageCount': '{{count}} / {{max}} messages',
        'conversation.atLimit': 'Message limit reached',
        'conversation.tierGateTitle': 'Upgrade to Talk',
        'conversation.tierGateDesc':
          'Direct Echo conversations are available on Core tier and above.',
        'conversation.upgrade': 'View Plans',
        'conversation.errorStarting': 'Could not start conversation.',
        'conversation.errorSending': 'Message could not be sent.',
        'conversation.errorSaving': 'Could not save conversation.',
        'conversation.messageLimitReached': "You've reached the message limit.",
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderConversation() {
  return render(
    <MemoryRouter initialEntries={['/echoes/e1/talk']}>
      <I18nextProvider i18n={testI18n}>
        <Routes>
          <Route path="/echoes/:echoId/talk" element={<EchoConversationPage />} />
        </Routes>
      </I18nextProvider>
    </MemoryRouter>,
  );
}

describe('EchoConversationPage', () => {
  it('shows tier gate for Free users', () => {
    renderConversation();
    expect(screen.getByText('Upgrade to Talk')).toBeInTheDocument();
  });

  it('shows upgrade CTA button', () => {
    renderConversation();
    expect(screen.getByText('View Plans')).toBeInTheDocument();
  });

  it('shows tier gate description', () => {
    renderConversation();
    expect(
      screen.getByText('Direct Echo conversations are available on Core tier and above.'),
    ).toBeInTheDocument();
  });

  it('shows back button', () => {
    renderConversation();
    expect(screen.getByText('Back')).toBeInTheDocument();
  });
});
