import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EchoConversationPage } from '../src/pages/EchoConversationPage.tsx';

// Mock stores — Free tier (now allowed with limits)
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
        // Header shows t('conversation.mood', { mood: getMoodLabel(...) }).
        // moodLabel.ts:37 aliases 'curious' → 'contemplative' then resolves
        // i18n.t('moods.contemplative'). Isolated test i18n needs the key.
        'moods.contemplative': 'Contemplative',
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
  it('shows conversation UI for Free tier users', () => {
    renderConversation();
    // Free tier is now allowed — should see the conversation interface, not a gate.
    expect(screen.queryByText('Upgrade to Talk')).not.toBeInTheDocument();
  });

  it('shows Echo name in header', () => {
    renderConversation();
    expect(screen.getByText('Test Echo')).toBeInTheDocument();
  });

  it('shows mood in header', () => {
    renderConversation();
    // EchoConversationPage.tsx:241 renders
    //   t('conversation.mood', { mood: getMoodLabel(echoMood) })
    // where echoMood='curious' is aliased to 'contemplative' by moodLabel.ts
    // and then i18n-resolved → 'Contemplative'.
    expect(screen.getByText('Feeling Contemplative')).toBeInTheDocument();
  });

  it('shows message limit for Free tier', () => {
    renderConversation();
    expect(screen.getByText('0 / 10 messages')).toBeInTheDocument();
  });
});
