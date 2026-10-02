import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n.ts';
import { TipPage } from '../src/pages/TipPage.tsx';

/**
 * R284.5: the tip's label is one key whose text holds the amount, and the
 * amount is US dollars formatted for the active locale by the browser, with
 * no currency sign written in code.
 */

vi.mock('../src/lib/api/endpoints.ts', () => ({
  payments: { createTip: vi.fn() },
}));

vi.mock('../src/lib/analytics.ts', () => ({ trackEvent: vi.fn() }));

afterEach(async () => {
  await i18n.changeLanguage('en');
});

async function renderTip() {
  await act(async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/tip']}>
          <TipPage />
        </MemoryRouter>
      </I18nextProvider>,
    );
  });
}

describe('the tip buttons (R284.5)', () => {
  it("show each provider's key with the amount", async () => {
    await renderTip();
    expect(
      screen.getByRole('button', {
        name: i18n.t('payment.payWithCryptoAmount', { amount: '$5.00' }),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: i18n.t('payment.payWithXRPAmount', { amount: '$5.00' }),
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '$25' })).toBeInTheDocument();
  });

  it('format the amount for the active locale', async () => {
    await act(async () => {
      await i18n.changeLanguage('de');
    });
    await renderTip();
    const crypto = screen.getByRole('button', {
      name: new RegExp(i18n.t('payment.payWithCryptoAmount', { amount: '' })),
    });
    expect(crypto.textContent).toContain('5,00');
    expect(crypto.textContent).not.toContain('$5.00');
    expect(
      screen.getByRole('button', { name: /^25\s\$$/ }),
    ).toBeInTheDocument();
  });
});
