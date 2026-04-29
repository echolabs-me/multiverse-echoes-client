// Lane H Commit 4 D5: ShareModal — server-issued-token wiring tests.
//
// The pre-Commit-4 ShareModal received `shareUrl` from the parent and the
// parent built it as `${origin}/share/${item.item_id}` — a URL the
// og-router Worker would always 404 (it expects a token UUID, not an
// item id). Commit 4 fixed that by switching ShareModal to take an
// `itemId` prop and POST to `/feeds/{itemId}/share` to receive the
// server-canonical share URL.
//
// These tests pin the new contract:
//   - On open, useCreateShare.create is called once with the itemId.
//   - During isLoading, copy/share/download buttons are disabled and a
//     loading indicator is shown.
//   - On success, the canonical share URL is rendered and the copy
//     button writes that URL (and only that URL) to the clipboard.
//   - On error, an error banner appears and action buttons stay disabled.
//   - Close + reopen mints a new token (per-share-token contract).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import { ShareModal } from '../src/components/ShareModal.tsx';

// Mock the hook BEFORE importing anything that pulls it in transitively.
// `vi.hoisted` keeps the mock state declarations available to the
// `vi.mock` factory, which executes before module loads.
const hookState = vi.hoisted(() => {
  return {
    create: vi.fn(),
    isLoading: false,
    error: null as Error | null,
    reset: vi.fn(),
  };
});

vi.mock('../src/hooks/useCreateShare.ts', () => ({
  useCreateShare: () => ({
    create: hookState.create,
    isLoading: hookState.isLoading,
    error: hookState.error,
    reset: hookState.reset,
  }),
}));

const CANONICAL_URL =
  'https://echolabsme.com/share/0193f9b8-1234-7000-8000-000000000001';

const SAMPLE_RESPONSE = {
  item_id: 'item-id-fixture',
  token: '0193f9b8-1234-7000-8000-000000000001',
  share_url: CANONICAL_URL,
  include_display_name: false,
  is_public: true,
  expires_at: null,
};

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        common: { close: 'Close', copied: 'Copied!', loading: 'Loading...' },
        share: {
          title: 'Share',
          copyLink: 'Copy link',
          shareToSocial: 'Share to social media',
          downloadImage: 'Download as image',
          previewDisclaimer:
            'AI-generated content — does not represent real events or people.',
          imageDisclaimer: 'AI-generated content — Multiverse Echoes',
          creating: 'Creating share link...',
          errorCreating: 'Could not create share link. Please try again.',
        },
      },
    },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

function renderModal(open: boolean, itemId = 'item-id-fixture') {
  return render(
    <I18nextProvider i18n={testI18n}>
      <ShareModal
        open={open}
        onClose={() => {}}
        title="Sample headline"
        body="Sample body text describing the share."
        itemId={itemId}
      />
    </I18nextProvider>,
  );
}

beforeEach(() => {
  hookState.create.mockReset();
  hookState.create.mockResolvedValue(SAMPLE_RESPONSE);
  hookState.reset.mockReset();
  hookState.isLoading = false;
  hookState.error = null;
});

describe('ShareModal — server-issued token wiring (Lane H Commit 4)', () => {
  it('calls useCreateShare.create exactly once with itemId on open', async () => {
    renderModal(true, 'fixture-item-id-123');
    await waitFor(() => {
      expect(hookState.create).toHaveBeenCalledTimes(1);
    });
    expect(hookState.create).toHaveBeenCalledWith('fixture-item-id-123');
  });

  it('disables copy/share/download buttons + shows loading indicator while isLoading', async () => {
    hookState.isLoading = true;
    // Make create() never resolve so the post-resolution setShareData
    // doesn't fire after the test ends — eliminates the act() warning
    // without suppressing the loading-state assertion itself.
    hookState.create.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      renderModal(true);
    });
    expect(screen.getByTestId('share-modal-loading')).toBeInTheDocument();
    expect(screen.getByTestId('share-modal-copy')).toBeDisabled();
    expect(screen.getByTestId('share-modal-download')).toBeDisabled();
  });

  it('on success: copy button writes the canonical server-issued URL to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    renderModal(true);
    // Wait for the create promise to resolve and shareData to populate.
    await waitFor(() => {
      expect(screen.getByTestId('share-modal-copy')).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('share-modal-copy'));
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(CANONICAL_URL);
  });

  it('on error: error banner displayed + action buttons remain disabled', async () => {
    hookState.error = new Error('boom');
    // Make create() reject (consistent with the error-state we manually
    // primed) so neither path leaves a setState scheduled after the
    // test ends.
    hookState.create.mockRejectedValue(new Error('boom'));
    await act(async () => {
      renderModal(true);
    });
    expect(screen.getByTestId('share-modal-error')).toBeInTheDocument();
    expect(screen.getByTestId('share-modal-copy')).toBeDisabled();
    expect(screen.getByTestId('share-modal-download')).toBeDisabled();
  });

  it('close + reopen: mints a new token (per-share-token contract)', async () => {
    const { rerender } = renderModal(true, 'fixture-item-id-123');
    await waitFor(() => {
      expect(hookState.create).toHaveBeenCalledTimes(1);
    });

    // Close
    rerender(
      <I18nextProvider i18n={testI18n}>
        <ShareModal
          open={false}
          onClose={() => {}}
          title="Sample headline"
          body="Sample body text describing the share."
          itemId="fixture-item-id-123"
        />
      </I18nextProvider>,
    );

    // Reopen — should fire create a second time, NOT cache the first.
    rerender(
      <I18nextProvider i18n={testI18n}>
        <ShareModal
          open={true}
          onClose={() => {}}
          title="Sample headline"
          body="Sample body text describing the share."
          itemId="fixture-item-id-123"
        />
      </I18nextProvider>,
    );

    await waitFor(() => {
      expect(hookState.create).toHaveBeenCalledTimes(2);
    });
  });
});
