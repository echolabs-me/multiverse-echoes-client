import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n.ts';
import { admin } from '../src/lib/api/endpoints.ts';
import { ApiRequestError } from '../src/lib/api/client.ts';
import { useToastStore } from '../src/stores/useToastStore.ts';
import { AdminDashboardPage } from '../src/pages/AdminDashboardPage.tsx';

/**
 * R286: each of the admin page's nine write catches shows a danger toast
 * with the translator's own text, and takes the status-page link from
 * `isPlatformError`. A refusal the server explains shows its code's text
 * with no link; a failure with no text of its own shows
 * `errors.INTERNAL_ERROR`'s, with the link.
 */

vi.mock('../src/stores/index.ts', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      user: {
        display_name: 'Admin',
        account_type: 'Admin',
        subscription_tier: 'GodMode',
      },
    }),
}));

vi.mock('../src/lib/api/endpoints.ts', () => ({
  admin: {
    systemHealth: vi.fn(),
    reports: vi.fn(),
    resolveReport: vi.fn(),
    users: vi.fn(),
    suspendUser: vi.fn(),
    unsuspendUser: vi.fn(),
    tickStatus: vi.fn(),
    tickPause: vi.fn(),
    tickResume: vi.fn(),
    triggerTick: vi.fn(),
    feedback: vi.fn(),
    updateFeedbackStatus: vi.fn(),
    updateFeedbackPriority: vi.fn(),
    createGithubIssue: vi.fn(),
    listModerators: vi.fn(),
    promoteModerator: vi.fn(),
    demoteModerator: vi.fn(),
  },
}));

const t = (key: string) => i18n.t(key);

beforeEach(() => {
  for (const fn of Object.values(admin)) vi.mocked(fn).mockReset();
  vi.mocked(admin.systemHealth).mockRejectedValue(new Error('not under test'));
  vi.mocked(admin.reports).mockResolvedValue([
    {
      report_id: 'r1',
      reporter_user_id: 'u2',
      target_type: 'Echo',
      target_id: 'e1',
      reason: 'Harassment',
      details: null,
      status: 'Open',
      priority: 1,
      created_at: '2026-09-30T00:00:00Z',
      resolved_at: null,
      resolution: null,
    },
  ] as never);
  vi.mocked(admin.users).mockResolvedValue([
    {
      user_id: 'u1',
      email: 'ada@example.com',
      display_name: 'ada',
      account_type: 'Standard',
      account_status: 'Active',
      subscription_tier: 'Free',
      echo_count: 1,
      created_at: '2026-09-01T00:00:00Z',
    },
  ] as never);
  vi.mocked(admin.tickStatus).mockResolvedValue({ paused: false } as never);
  vi.mocked(admin.feedback).mockResolvedValue([
    {
      feedback_id: 'f1',
      user_id: 'u1',
      feedback_type: 'Bug',
      user_message: 'Message f1',
      structured_summary: 'Summary f1',
      context: { screen: 'settings', recent_events: [] },
      status: 'New',
      priority: null,
      github_issue_url: null,
      resolution_notes: null,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    },
  ] as never);
  vi.mocked(admin.listModerators).mockResolvedValue([
    {
      user_id: '11111111-1111-4111-8111-111111111111',
      email: 'alice@example.com',
      display_name: 'Alice',
      account_type: 'Moderator',
      updated_at: '2026-04-17T12:00:00Z',
    },
  ] as never);
  useToastStore.setState({ toasts: [] });
});

async function openTab(tabKey: string) {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <I18nextProvider i18n={i18n}>
          <AdminDashboardPage />
        </I18nextProvider>
      </MemoryRouter>,
    );
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('tab', { name: t(tabKey) }));
  });
}

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

type Write = keyof typeof admin;

// Each catch: the write that fails, and how the test reaches it.
const catches: [string, Write, () => Promise<void>][] = [
  [
    'resolving a report',
    'resolveReport',
    async () => {
      await openTab('admin.tabReports');
      await click(t('admin.resolve'));
      fireEvent.change(screen.getByLabelText(t('admin.resolutionNotes')), {
        target: { value: 'Handled.' },
      });
      await click(t('common.confirm'));
    },
  ],
  [
    'suspending a user',
    'suspendUser',
    async () => {
      await openTab('admin.tabUsers');
      await click(t('admin.suspend'));
    },
  ],
  [
    'pausing the tick engine',
    'tickPause',
    async () => {
      await openTab('admin.tabControls');
      await click(t('admin.pauseTick'));
    },
  ],
  [
    'triggering a tick',
    'triggerTick',
    async () => {
      await openTab('admin.tabControls');
      await click(t('admin.triggerTick'));
    },
  ],
  [
    "setting a feedback item's status",
    'updateFeedbackStatus',
    async () => {
      await openTab('admin.tabFeedback');
      await click(t('admin.feedbackAcknowledge'));
    },
  ],
  [
    "setting a feedback item's priority",
    'updateFeedbackPriority',
    async () => {
      await openTab('admin.tabFeedback');
      await act(async () => {
        fireEvent.change(
          screen.getByDisplayValue(t('admin.feedbackPriorityLabel')),
          { target: { value: 'P1' } },
        );
      });
    },
  ],
  [
    'creating a GitHub issue',
    'createGithubIssue',
    async () => {
      vi.mocked(admin.feedback).mockResolvedValue([
        {
          feedback_id: 'f1',
          user_id: 'u1',
          feedback_type: 'Bug',
          user_message: 'Message f1',
          structured_summary: 'Summary f1',
          context: { screen: 'settings', recent_events: [] },
          status: 'Acknowledged',
          priority: 'P1',
          github_issue_url: null,
          resolution_notes: null,
          created_at: '2026-10-01T00:00:00Z',
          updated_at: '2026-10-01T00:00:00Z',
        },
      ] as never);
      await openTab('admin.tabFeedback');
      await click(t('admin.feedbackCreateIssue'));
    },
  ],
  [
    'promoting a moderator',
    'promoteModerator',
    async () => {
      await openTab('admin.tabModerators');
      fireEvent.change(
        screen.getByLabelText(t('admin.moderators.promotePlaceholder')),
        { target: { value: '22222222-2222-4222-8222-222222222222' } },
      );
      await click(t('admin.moderators.promote'));
    },
  ],
  [
    'demoting a moderator',
    'demoteModerator',
    async () => {
      await openTab('admin.tabModerators');
      await click(t('admin.moderators.demote'));
      await click(t('common.confirm'));
    },
  ],
];

const failures: [string, () => Error, string, boolean][] = [
  [
    'a refusal the server explains',
    () => new ApiRequestError(403, 'FORBIDDEN', 'The server says no.'),
    'errors.FORBIDDEN',
    false,
  ],
  [
    'a failure with no text of its own',
    () => new TypeError('Failed to fetch'),
    'errors.INTERNAL_ERROR',
    true,
  ],
];

describe("each admin write's failure shows the translator's text (R286)", () => {
  for (const [what, write, reach] of catches) {
    for (const [kind, error, key, platformLink] of failures) {
      it(`${what}: ${kind}`, async () => {
        vi.mocked(admin[write]).mockRejectedValue(error());
        await reach();
        expect(admin[write]).toHaveBeenCalledTimes(1);
        expect(useToastStore.getState().toasts).toEqual([
          expect.objectContaining({
            message: t(key),
            severity: 'danger',
            platformLink,
          }),
        ]);
      });
    }
  }
});
