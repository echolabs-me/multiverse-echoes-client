import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n.ts';
import { ContactPage } from '../src/pages/ContactPage.tsx';

/**
 * R284.1: when the contact Worker refuses, the page shows its own locale
 * string, never the Worker's text, which is English and not ours. `fetch` is
 * stood in for, so nothing leaves the machine (SR51).
 */

const text = (key: string) => i18n.t(key);

async function submitRefusedWith(status: number) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'The Worker says no.' }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
  await act(async () => {
    render(
      <HelmetProvider>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/contact']}>
            <ContactPage />
          </MemoryRouter>
        </I18nextProvider>
      </HelmetProvider>,
    );
  });
  fireEvent.change(screen.getByLabelText(text('contact.labelName')), {
    target: { value: 'Ada' },
  });
  fireEvent.change(screen.getByLabelText(text('contact.labelEmail')), {
    target: { value: 'ada@example.com' },
  });
  fireEvent.change(screen.getByLabelText(text('contact.labelMessage')), {
    target: { value: 'Hello there.' },
  });
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: text('contact.sendMessage') }),
    );
  });
}

describe('ContactPage shows its own string when the Worker refuses (R284.1)', () => {
  it.each([
    [400, 'contact.errorBadRequest'],
    [429, 'contact.errorRateLimit'],
    [500, 'contact.errorGeneric'],
  ])('a %i shows %s', async (status, key) => {
    await submitRefusedWith(status);
    expect(screen.getByRole('alert').textContent).toBe(text(key));
    expect(screen.queryByText('The Worker says no.')).not.toBeInTheDocument();
  });
});
