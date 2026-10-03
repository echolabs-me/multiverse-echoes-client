import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n.ts';
import { admin } from '../src/lib/api/endpoints.ts';
import { AdminDashboardPage } from '../src/pages/AdminDashboardPage.tsx';

/**
 * R265: every admin control that sends a write sends it once. A double
 * click in one tick sends one request, the control is disabled until the
 * request settles, and a held row does not block another row. Each write
 * is stood in for by a request that never settles.
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
    systemHealth: vi.fn().mockRejectedValue(new Error('not under test')),
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
  },
}));

const t = (key: string) => i18n.t(key);
const never = () => new Promise<never>(() => {});

const USER = (id: string, name: string) => ({
  user_id: id,
  email: `${name}@example.com`,
  display_name: name,
  account_type: 'Standard',
  account_status: 'Active',
  subscription_tier: 'Free',
  echo_count: 1,
  created_at: '2026-09-01T00:00:00Z',
});

const FEEDBACK = (id: string, status: string, priority: string | null) => ({
  feedback_id: id,
  user_id: 'u1',
  feedback_type: 'Bug',
  user_message: `Message ${id}`,
  structured_summary: `Summary ${id}`,
  context: { screen: 'settings', recent_events: [] },
  status,
  priority,
  github_issue_url: null,
  resolution_notes: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
});

beforeEach(() => {
  for (const fn of Object.values(admin)) vi.mocked(fn).mockReset();
  vi.mocked(admin.systemHealth).mockRejectedValue(new Error('not under test'));
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

async function doubleClick(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el);
    fireEvent.click(el);
  });
}

// Rule 14: text this unit moved into keys. Each key is given other text
// for its test, because its English equals what the code once wrote.
const overridden: [string, string][] = [];
function overrideText(key: string, value: string) {
  overridden.push([key, i18n.t(key)]);
  i18n.addResource('en', 'translation', key, value);
}
afterEach(() => {
  for (const [key, value] of overridden.splice(0)) {
    i18n.addResource('en', 'translation', key, value);
  }
});

describe("the admin controls' own text comes from the locale (Rule 14)", () => {
  it('the tick badge and the paused note', async () => {
    overrideText('admin.tickBadgePaused', 'Engine stopped');
    overrideText('admin.tickPausedDesc', 'Nothing runs while stopped.');
    vi.mocked(admin.tickStatus).mockResolvedValue({ paused: true } as never);
    await openTab('admin.tabControls');
    expect(screen.getByText('Engine stopped')).toBeInTheDocument();
    expect(screen.getByText('Nothing runs while stopped.')).toBeInTheDocument();
  });

  it('the running badge', async () => {
    overrideText('admin.tickBadgeRunning', 'Engine going');
    vi.mocked(admin.tickStatus).mockResolvedValue({ paused: false } as never);
    await openTab('admin.tabControls');
    expect(screen.getByText('Engine going')).toBeInTheDocument();
  });

  it("the feedback queue's issue button", async () => {
    overrideText('admin.feedbackCreateIssue', 'File an issue');
    vi.mocked(admin.feedback).mockResolvedValue([
      FEEDBACK('f1', 'Acknowledged', 'P1'),
    ] as never);
    await openTab('admin.tabFeedback');
    expect(
      screen.getByRole('button', { name: 'File an issue' }),
    ).toBeInTheDocument();
  });
});

describe('admin writes send once (R265)', () => {
  it('resolving a report', async () => {
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
    vi.mocked(admin.resolveReport).mockReturnValue(never());
    await openTab('admin.tabReports');
    fireEvent.click(screen.getByRole('button', { name: t('admin.resolve') }));
    fireEvent.change(screen.getByLabelText(t('admin.resolutionNotes')), {
      target: { value: 'Handled.' },
    });
    const confirm = screen.getByRole('button', { name: t('common.confirm') });
    await doubleClick(confirm);
    expect(admin.resolveReport).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
  });

  it('suspending a user, and a held row does not block another row', async () => {
    vi.mocked(admin.users).mockResolvedValue([
      USER('u1', 'ada'),
      USER('u2', 'bob'),
    ] as never);
    vi.mocked(admin.suspendUser).mockReturnValue(never());
    await openTab('admin.tabUsers');
    const [first, second] = screen.getAllByRole('button', {
      name: t('admin.suspend'),
    });
    await doubleClick(first);
    expect(admin.suspendUser).toHaveBeenCalledTimes(1);
    expect(first).toBeDisabled();
    expect(second).toBeEnabled();
    await act(async () => {
      fireEvent.click(second);
    });
    expect(vi.mocked(admin.suspendUser).mock.calls).toEqual([['u1'], ['u2']]);
  });

  it('pausing the tick engine', async () => {
    vi.mocked(admin.tickStatus).mockResolvedValue({ paused: false } as never);
    vi.mocked(admin.tickPause).mockReturnValue(never());
    await openTab('admin.tabControls');
    const pause = screen.getByRole('button', { name: t('admin.pauseTick') });
    await doubleClick(pause);
    expect(admin.tickPause).toHaveBeenCalledTimes(1);
    expect(admin.tickResume).not.toHaveBeenCalled();
    expect(pause).toBeDisabled();
  });

  it('triggering a tick', async () => {
    vi.mocked(admin.tickStatus).mockResolvedValue({ paused: false } as never);
    vi.mocked(admin.triggerTick).mockReturnValue(never());
    await openTab('admin.tabControls');
    const trigger = screen.getByRole('button', {
      name: t('admin.triggerTick'),
    });
    await doubleClick(trigger);
    expect(admin.triggerTick).toHaveBeenCalledTimes(1);
    expect(trigger).toBeDisabled();
  });

  it('acknowledging feedback', async () => {
    vi.mocked(admin.feedback).mockResolvedValue([
      FEEDBACK('f1', 'New', null),
    ] as never);
    vi.mocked(admin.updateFeedbackStatus).mockReturnValue(never());
    await openTab('admin.tabFeedback');
    const ack = screen.getByRole('button', {
      name: t('admin.feedbackAcknowledge'),
    });
    await doubleClick(ack);
    expect(admin.updateFeedbackStatus).toHaveBeenCalledTimes(1);
    expect(ack).toBeDisabled();
  });

  it("setting a feedback item's priority", async () => {
    vi.mocked(admin.feedback).mockResolvedValue([
      FEEDBACK('f1', 'New', null),
    ] as never);
    vi.mocked(admin.updateFeedbackPriority).mockReturnValue(never());
    await openTab('admin.tabFeedback');
    const select = screen.getByDisplayValue(t('admin.feedbackPriorityLabel'));
    await act(async () => {
      fireEvent.change(select, { target: { value: 'P1' } });
      fireEvent.change(select, { target: { value: 'P2' } });
    });
    expect(admin.updateFeedbackPriority).toHaveBeenCalledTimes(1);
    expect(select).toBeDisabled();
  });

  it('creating a GitHub issue', async () => {
    vi.mocked(admin.feedback).mockResolvedValue([
      FEEDBACK('f1', 'Acknowledged', 'P1'),
    ] as never);
    vi.mocked(admin.createGithubIssue).mockReturnValue(never());
    await openTab('admin.tabFeedback');
    const create = screen.getByRole('button', {
      name: t('admin.feedbackCreateIssue'),
    });
    await doubleClick(create);
    expect(admin.createGithubIssue).toHaveBeenCalledTimes(1);
    expect(create).toBeDisabled();
  });
});
