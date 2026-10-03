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
  echoes: { startVoiceSession: vi.fn(), stopVoiceSession: vi.fn() },
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

describe('VoiceSessionModal — the way out (R265.4)', () => {
  it('a double click on close ends the session once', async () => {
    const onClose = vi.fn();
    vi.mocked(echoes.stopVoiceSession).mockReturnValue(new Promise(() => {}));
    await act(async () => {
      render(
        <I18nextProvider i18n={i18n}>
          <VoiceSessionModal
            echoId="e1"
            echoName="Test Echo"
            avatarUrl={null}
            onClose={onClose}
          />
        </I18nextProvider>,
      );
    });
    const close = screen.getByRole('button', { name: i18n.t('voice.close') });
    await act(async () => {
      fireEvent.click(close);
      fireEvent.click(close);
    });
    // The stop request has not settled, so the session is still ending.
    expect(echoes.stopVoiceSession).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(close).toBeDisabled();
  });
});

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
