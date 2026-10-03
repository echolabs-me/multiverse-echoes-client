import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n.ts';
import { notifications } from '../src/lib/api/endpoints.ts';
import { useNotificationStore } from '../src/stores/useNotificationStore.ts';
import { useToastStore } from '../src/stores/useToastStore.ts';
import { ApiRequestError } from '../src/lib/api/client.ts';
import { NotificationsPage } from '../src/pages/NotificationsPage.tsx';

/**
 * R265: the notifications page's writes send once. The real store runs,
 * with only the endpoints stood in for; marking read never settles.
 */

vi.mock('../src/lib/api/endpoints.ts', () => ({
  notifications: { list: vi.fn(), markRead: vi.fn() },
}));

vi.mock('../src/lib/analytics.ts', () => ({ trackEvent: vi.fn() }));

const note = (id: string, title: string) => ({
  notification_id: id,
  category: 'platform',
  title,
  body: `Body ${id}`,
  content_locale: 'en',
  link: '',
  read: false,
  created_at: '2026-10-01T00:00:00Z',
});

beforeEach(() => {
  useNotificationStore.setState({ notifications: [], unreadCount: 0 });
  useToastStore.setState({ toasts: [] });
  vi.mocked(notifications.list).mockResolvedValue([
    note('n1', 'First'),
    note('n2', 'Second'),
  ]);
  vi.mocked(notifications.markRead).mockReset();
  vi.mocked(notifications.markRead).mockReturnValue(new Promise(() => {}));
});

/** A promise the test settles by hand. */
function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const sentFor = () =>
  vi.mocked(notifications.markRead).mock.calls.map(([id]) => id);

async function renderPage() {
  await act(async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/notifications']}>
          <NotificationsPage />
        </MemoryRouter>
      </I18nextProvider>,
    );
  });
}

describe('NotificationsPage writes send once (R265)', () => {
  it('marking all read', async () => {
    await renderPage();
    const markAll = screen.getByRole('button', {
      name: i18n.t('common.markAllRead'),
    });
    await act(async () => {
      fireEvent.click(markAll);
      fireEvent.click(markAll);
    });
    // The first request has not settled, so the loop is on its first item.
    expect(notifications.markRead).toHaveBeenCalledTimes(1);
    expect(markAll).toBeDisabled();
  });

  it('opening a notification', async () => {
    await renderPage();
    const first = screen.getByRole('button', { name: /First/ });
    await act(async () => {
      fireEvent.click(first);
      fireEvent.click(first);
    });
    expect(notifications.markRead).toHaveBeenCalledTimes(1);
    expect(first).toBeDisabled();
    expect(screen.getByRole('button', { name: /Second/ })).toBeEnabled();
  });
});

describe('Opening a row and "mark all read" share the row\'s marker (R285.2)', () => {
  const markAllButton = () =>
    screen.getByRole('button', { name: i18n.t('common.markAllRead') });

  it('a row opened while "mark all read" is marking it is sent once', async () => {
    await renderPage();
    await act(async () => {
      fireEvent.click(markAllButton());
    });
    const first = screen.getByRole('button', { name: /First/ });
    expect(first).toBeDisabled();
    await act(async () => {
      fireEvent.click(first);
    });
    expect(sentFor()).toEqual(['n1']);
  });

  it('"mark all read" skips a row whose open is marking it', async () => {
    await renderPage();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /First/ }));
    });
    await act(async () => {
      fireEvent.click(markAllButton());
    });
    // The batch passes the first row and marks the second.
    expect(sentFor()).toEqual(['n1', 'n2']);
  });

  it('"mark all read" does not send a row read while it ran', async () => {
    const firstRead = deferred();
    vi.mocked(notifications.markRead).mockImplementation((id: string) =>
      id === 'n1' ? firstRead.promise : Promise.resolve(),
    );
    await renderPage();
    await act(async () => {
      fireEvent.click(markAllButton());
    });
    // The second row is opened and marked while the batch waits on the
    // first; the batch then finds it read and sends nothing for it.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Second/ }));
    });
    await act(async () => {
      firstRead.resolve();
    });
    expect(sentFor()).toEqual(['n1', 'n2']);
  });
});

describe("A failed read shows the translator's text", () => {
  const failure = () => new ApiRequestError(503, 'INTERNAL_ERROR', 'down');

  it('when "mark all read" fails', async () => {
    vi.mocked(notifications.markRead).mockRejectedValue(failure());
    await renderPage();
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: i18n.t('common.markAllRead') }),
      );
    });
    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({
        message: i18n.t('errors.INTERNAL_ERROR'),
        severity: 'danger',
        platformLink: true,
      }),
    ]);
  });

  it('when opening a row fails', async () => {
    vi.mocked(notifications.markRead).mockRejectedValue(failure());
    await renderPage();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /First/ }));
    });
    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({
        message: i18n.t('errors.INTERNAL_ERROR'),
        severity: 'danger',
        platformLink: true,
      }),
    ]);
  });
});
