import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n.ts';
import { ApiRequestError } from '../src/lib/api/client.ts';
import { isPlatformError } from '../src/lib/translateError.ts';
import { payments } from '../src/lib/api/endpoints.ts';
import { useToastStore } from '../src/stores/useToastStore.ts';
import { TipPage } from '../src/pages/TipPage.tsx';

/**
 * R283.3: one function decides the status-page link. A toast showing a
 * caught error's text carries it only when the error is the platform's: not
 * the server's answer at all, or the server answering 500 or above.
 */

vi.mock('../src/lib/api/endpoints.ts', () => ({
  payments: { createTip: vi.fn() },
}));

vi.mock('../src/lib/analytics.ts', () => ({ trackEvent: vi.fn() }));

beforeEach(() => {
  vi.mocked(payments.createTip).mockReset();
  useToastStore.setState({ toasts: [] });
});

describe('isPlatformError', () => {
  it('is false for a refusal the server explains below 500', () => {
    expect(isPlatformError(new ApiRequestError(400, 'NAME_TAKEN', ''))).toBe(
      false,
    );
    expect(isPlatformError(new ApiRequestError(499, 'X', ''))).toBe(false);
  });

  it('is true for the server answering 500 or above', () => {
    expect(
      isPlatformError(new ApiRequestError(500, 'INTERNAL_ERROR', '')),
    ).toBe(true);
    expect(isPlatformError(new ApiRequestError(503, 'UNKNOWN', ''))).toBe(true);
  });

  it("is true for anything that is not the server's answer", () => {
    expect(isPlatformError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isPlatformError(new Error('boom'))).toBe(true);
    expect(isPlatformError('a thrown string')).toBe(true);
  });
});

describe("a page's toast takes its link from isPlatformError", () => {
  async function failTip(err: unknown) {
    vi.mocked(payments.createTip).mockRejectedValue(err);
    await act(async () => {
      render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/tip']}>
            <TipPage />
          </MemoryRouter>
        </I18nextProvider>,
      );
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: new RegExp(i18n.t('payment.payWithCrypto')),
        }),
      );
    });
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    return toasts[0];
  }

  it('a 400 with a code carries no link', async () => {
    const toast = await failTip(
      new ApiRequestError(400, 'RATE_LOOKUP_FAILED', 'rate lookup failed'),
    );
    expect(toast.message).toBe(i18n.t('errors.RATE_LOOKUP_FAILED'));
    expect(toast.platformLink).toBe(false);
  });

  it('a 500 carries it', async () => {
    const toast = await failTip(
      new ApiRequestError(500, 'INTERNAL_ERROR', 'internal'),
    );
    expect(toast.platformLink).toBe(true);
  });

  it('a failure that is not an ApiRequestError carries it', async () => {
    const toast = await failTip(new TypeError('Failed to fetch'));
    expect(toast.message).toBe(i18n.t('common.error'));
    expect(toast.platformLink).toBe(true);
  });
});
