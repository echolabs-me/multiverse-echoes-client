import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n.ts';
import { echoes } from '../src/lib/api/endpoints.ts';
import { VoiceSessionModal } from '../src/components/VoiceSessionModal.tsx';

/**
 * R284.4: a microphone the browser refuses has its own text, and any other
 * failure to get the microphone is the connection error.
 */

vi.mock('../src/lib/api/endpoints.ts', () => ({
  echoes: { startVoiceSession: vi.fn() },
}));

class FakeAudioContext {
  state = 'running';
  resume = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);
}

const getUserMedia = vi.fn();

beforeEach(() => {
  vi.stubGlobal('AudioContext', FakeAudioContext);
  getUserMedia.mockReset();
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
  vi.mocked(echoes.startVoiceSession).mockReset();
});

async function startWithMicFailure(err: unknown) {
  getUserMedia.mockRejectedValue(err);
  await act(async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <VoiceSessionModal
          echoId="e1"
          echoName="Test Echo"
          avatarUrl={null}
          onClose={vi.fn()}
        />
      </I18nextProvider>,
    );
  });
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: i18n.t('voice.startCall') }),
    );
  });
}

describe('VoiceSessionModal — the microphone (R284.4)', () => {
  it('shows its own text when the browser refuses the microphone', async () => {
    await startWithMicFailure(new DOMException('denied', 'NotAllowedError'));
    expect(screen.getByText(i18n.t('voice.micRefused'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('voice.error'))).not.toBeInTheDocument();
    expect(echoes.startVoiceSession).not.toHaveBeenCalled();
  });

  it('shows the connection error for any other failure', async () => {
    await startWithMicFailure(new DOMException('no device', 'NotFoundError'));
    expect(screen.getByText(i18n.t('voice.error'))).toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('voice.micRefused')),
    ).not.toBeInTheDocument();
  });
});
