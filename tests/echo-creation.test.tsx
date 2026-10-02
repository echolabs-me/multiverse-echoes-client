import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { EchoCreationPage } from '../src/pages/EchoCreationPage.tsx';
import { account, shards } from '../src/lib/api/endpoints.ts';
import { ApiRequestError } from '../src/lib/api/client.ts';
import { SHARED_SHARD_NOTICE_REQUIRED } from '../src/hooks/useSharedShardNotice.tsx';
import type { PrivacySettings } from '../src/types/api.ts';

const mocks = vi.hoisted(() => ({
  createEcho: vi.fn(),
}));

vi.mock('../src/stores/useEchoStore.ts', () => ({
  // EchoCreationPage selects `createEcho` from the store.
  useEchoStore: (
    select: (s: { createEcho: typeof mocks.createEcho }) => unknown,
  ) => select({ createEcho: mocks.createEcho }),
}));

vi.mock('../src/lib/api/endpoints.ts', () => ({
  shards: { list: vi.fn() },
  account: {
    getPrivacy: vi.fn(),
    acknowledgeSharedShardNotice: vi.fn(),
  },
}));

vi.mock('../src/components/EchoBirthAnimation.tsx', () => ({
  EchoBirthAnimation: () => <div data-testid="birth" />,
}));

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: vi.fn(),
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'echo.createTitle': 'Create your Echo',
        'echo.nameLabel': 'Echo name',
        'echo.namePlaceholder': 'Give your Echo a name',
        'echo.whatIfLabel': 'What if...',
        'echo.whatIfSubtitle': 'The prompt that defines your Echo',
        'echo.whatIfPlaceholder': 'What if I had...',
        'echo.personaLabel': 'Persona',
        'echo.personaHint': 'Describe the persona',
        'echo.personaOptionalPlaceholder': 'Optional persona details',
        'echo.personaDeclaration': 'Inspired by me',
        'echo.personaFictional': 'Fictional character',
        'echo.consentTitle': 'Consent',
        'echo.consentAcknowledge': 'I acknowledge',
        'echo.consentPrivacy': 'I accept privacy terms',
        'echo.destinationTitle': 'Choose destination',
        'echo.personalShard': 'Personal Shard',
        'echo.personalShardDesc': 'Your private world',
        'echo.limitTitle': 'Echo limit reached',
        'echo.limitDesc': 'Upgrade your plan',
        'echo.viewPlans': 'View plans',
        'echo.createButton': 'Create Echo',
        'echo.birthTitle': 'Your Echo is being born...',
        'echo.birthComplete': 'Echo created!',
        'common.cancel': 'Cancel',
        'common.next': 'Next',
        'common.back': 'Back',
        'common.continue': 'Continue',
        'common.close': 'Close',
        'sharedShardNotice.title': 'Entering a shared world',
        'sharedShardNotice.body': 'In shared worlds, your Echo meets others.',
        'sharedShardNotice.privacyLink': 'Read the privacy policy',
        'sharedShardNotice.accept': 'I understand',
        'sharedShardNotice.cancel': 'Cancel',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/echoes/create']}>
        <EchoCreationPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

beforeEach(() => {
  // happy-dom has no showModal: open and close the dialog by its attribute,
  // which is what makes it reachable by role.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
  mocks.createEcho.mockReset();
  mocks.createEcho.mockResolvedValue({ echo_id: 'e1' });
  vi.mocked(shards.list).mockResolvedValue([
    {
      shard_id: 'pub1',
      name: 'Harbour',
      description: 'A harbour town.',
      shard_type: 'Public',
    },
  ] as unknown as Awaited<ReturnType<typeof shards.list>>);
  vi.mocked(account.getPrivacy).mockReset();
  vi.mocked(account.getPrivacy).mockResolvedValue({
    solo_mode: false,
    do_not_sell: false,
    analytics_opt_out: false,
    community_opt_out: false,
    community_opt_out_cleanup_pending: false,
    shared_shard_notice_acknowledged_at: null,
    profile_visibility: 'Public',
  });
  vi.mocked(account.acknowledgeSharedShardNotice).mockReset();
  vi.mocked(account.acknowledgeSharedShardNotice).mockResolvedValue(undefined);
});

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

/** Fills in the details and consent, reaching the destination step, where
 *  the first Public shard is selected. */
async function reachDestination() {
  await act(async () => {
    renderPage();
  });
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Echo name'), {
      target: { value: 'Wanderer' },
    });
    fireEvent.change(screen.getByPlaceholderText('What if I had...'), {
      target: { value: 'What if I sailed away?' },
    });
  });
  await click(screen.getByRole('button', { name: 'Next' }));
  await click(screen.getByLabelText('I acknowledge'));
  await click(screen.getByLabelText('I accept privacy terms'));
  await click(screen.getByRole('button', { name: 'Next' }));
}

/** What a browser does on a repeated Escape: a `cancel` the page cannot
 *  prevent, and then, in a later task, the dialog closes. */
async function browserCloses(dialog: HTMLElement) {
  await act(async () => {
    fireEvent(dialog, new Event('cancel', { cancelable: false }));
  });
  await act(async () => {
    (dialog as HTMLDialogElement).close();
    fireEvent(dialog, new Event('close'));
  });
}

function notice() {
  return screen.queryByRole('dialog', { name: 'Entering a shared world' });
}

function privacy(acknowledgedAt: string | null): PrivacySettings {
  return {
    solo_mode: false,
    do_not_sell: false,
    analytics_opt_out: false,
    community_opt_out: false,
    community_opt_out_cleanup_pending: false,
    shared_shard_notice_acknowledged_at: acknowledgedAt,
    profile_visibility: 'Public',
  };
}

/** A promise and the function that settles it, for a request the test
 *  holds open. */
function held<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('EchoCreationPage', () => {
  it('renders creation wizard title', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByText('Create your Echo')).toBeInTheDocument();
  });

  it('renders name and what-if prompt fields', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByLabelText('Echo name')).toBeInTheDocument();
    expect(screen.getByText(/What if/)).toBeInTheDocument();
  });

  it('has cancel and next buttons', async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('shows the shared-shard notice at once before creating in a Public shard, and cancelling creates nothing (R216.4, R253)', async () => {
    await reachDestination();
    await click(screen.getByRole('button', { name: 'Create Echo' }));

    const shown = notice();
    expect(shown).not.toBeNull();
    expect(mocks.createEcho).not.toHaveBeenCalled();
    expect(account.getPrivacy).toHaveBeenCalledTimes(1);
    await click(
      within(shown as HTMLElement).getByRole('button', { name: 'Cancel' }),
    );
    expect(mocks.createEcho).not.toHaveBeenCalled();
    expect(account.acknowledgeSharedShardNotice).not.toHaveBeenCalled();
    expect(screen.getByText('Choose destination')).toBeInTheDocument();
  });

  it('accepting the notice acknowledges it and creates the Echo in the Public shard (R216.4)', async () => {
    await reachDestination();
    await click(screen.getByRole('button', { name: 'Create Echo' }));
    await click(
      within(notice() as HTMLElement).getByRole('button', {
        name: 'I understand',
      }),
    );

    expect(account.acknowledgeSharedShardNotice).toHaveBeenCalledTimes(1);
    expect(mocks.createEcho).toHaveBeenCalledTimes(1);
    expect(mocks.createEcho.mock.calls[0]?.[0]).toMatchObject({
      shard_id: 'pub1',
    });
  });

  it('once the acknowledgment lands, the birth step shows while the create runs, with no notice (R257.3)', async () => {
    const create = held<{ echo_id: string }>();
    mocks.createEcho.mockReturnValueOnce(create.promise);
    await reachDestination();
    await click(screen.getByRole('button', { name: 'Create Echo' }));
    await click(
      within(notice() as HTMLElement).getByRole('button', {
        name: 'I understand',
      }),
    );

    expect(mocks.createEcho).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('birth')).toBeInTheDocument();
    expect(notice()).toBeNull();
    expect(screen.queryByText('Choose destination')).toBeNull();

    await act(async () => {
      create.resolve({ echo_id: 'e1' });
    });
    expect(screen.getByTestId('birth')).toBeInTheDocument();
  });

  it('a failed acknowledgment closes the notice, creates nothing and shows the page’s error on the destination step (R254.3)', async () => {
    vi.mocked(account.acknowledgeSharedShardNotice).mockRejectedValueOnce(
      new Error('acknowledgment failed'),
    );
    await reachDestination();
    await click(screen.getByRole('button', { name: 'Create Echo' }));
    await click(
      within(notice() as HTMLElement).getByRole('button', {
        name: 'I understand',
      }),
    );

    expect(mocks.createEcho).not.toHaveBeenCalled();
    expect(notice()).toBeNull();
    expect(screen.getByText('acknowledgment failed')).toBeInTheDocument();
    expect(screen.getByText('Choose destination')).toBeInTheDocument();
  });

  it('creates in the Personal shard without the notice', async () => {
    await reachDestination();
    await click(screen.getByText('Personal Shard'));
    await click(screen.getByRole('button', { name: 'Create Echo' }));

    expect(notice()).toBeNull();
    expect(mocks.createEcho).toHaveBeenCalledTimes(1);
    expect(mocks.createEcho.mock.calls[0]?.[0]).toMatchObject({
      shard_id: undefined,
    });
  });

  it('an acknowledged user’s click creates at once, with no read left pending that could create again after Back (R253)', async () => {
    // Any read after the page opened is held open, so a click that waited
    // on one would leave the Back button live with the create still to come.
    const later = held<PrivacySettings>();
    vi.mocked(account.getPrivacy)
      .mockResolvedValueOnce(privacy('2026-10-02T00:00:00Z'))
      .mockReturnValue(later.promise);
    await reachDestination();

    await click(screen.getByRole('button', { name: 'Create Echo' }));
    expect(mocks.createEcho).toHaveBeenCalledTimes(1);
    expect(account.getPrivacy).toHaveBeenCalledTimes(1);
    expect(notice()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();

    await act(async () => {
      later.resolve(privacy('2026-10-02T00:00:00Z'));
    });
    expect(mocks.createEcho).toHaveBeenCalledTimes(1);
  });

  it('creates when the acknowledgment is not yet known, and a 409 shows the notice on the destination step (R253)', async () => {
    vi.mocked(account.getPrivacy).mockReturnValue(
      held<PrivacySettings>().promise,
    );
    mocks.createEcho
      .mockRejectedValueOnce(
        new ApiRequestError(409, SHARED_SHARD_NOTICE_REQUIRED, 'acknowledge'),
      )
      .mockResolvedValueOnce({ echo_id: 'e1' });
    await reachDestination();

    await click(screen.getByRole('button', { name: 'Create Echo' }));
    expect(mocks.createEcho).toHaveBeenCalledTimes(1);
    expect(notice()).not.toBeNull();
    expect(screen.getByText('Choose destination')).toBeInTheDocument();

    await click(
      within(notice() as HTMLElement).getByRole('button', {
        name: 'I understand',
      }),
    );
    expect(account.acknowledgeSharedShardNotice).toHaveBeenCalledTimes(1);
    expect(mocks.createEcho).toHaveBeenCalledTimes(2);
  });

  it('after Accept, the notice cannot be dismissed until the acknowledgment settles (R257.1)', async () => {
    const acknowledgment = held<undefined>();
    vi.mocked(account.acknowledgeSharedShardNotice).mockReturnValue(
      acknowledgment.promise,
    );
    await reachDestination();
    await click(screen.getByRole('button', { name: 'Create Echo' }));
    const shown = notice() as HTMLElement;
    await click(within(shown).getByRole('button', { name: 'I understand' }));

    await click(within(shown).getByRole('button', { name: 'Close' }));
    await act(async () => {
      fireEvent(shown, new Event('cancel', { cancelable: true }));
    });
    await click(shown);
    await browserCloses(shown);
    expect(notice()).not.toBeNull();
    expect(
      within(shown).getByRole('button', { name: 'Cancel' }),
    ).toBeDisabled();
    expect(
      within(shown).getByRole('button', { name: 'I understand' }),
    ).toBeDisabled();
    expect(mocks.createEcho).not.toHaveBeenCalled();

    await act(async () => {
      acknowledgment.resolve(undefined);
    });
    expect(mocks.createEcho).toHaveBeenCalledTimes(1);
    expect(notice()).toBeNull();
  });

  it('a double click on Create Echo opens one notice and creates one Echo, and the button is disabled while it runs (R249)', async () => {
    await reachDestination();
    const create = screen.getByRole('button', { name: 'Create Echo' });

    await click(create);
    expect(create).toBeDisabled();
    await click(create);
    await click(
      within(notice() as HTMLElement).getByRole('button', {
        name: 'I understand',
      }),
    );

    expect(account.acknowledgeSharedShardNotice).toHaveBeenCalledTimes(1);
    expect(mocks.createEcho).toHaveBeenCalledTimes(1);
  });
});
