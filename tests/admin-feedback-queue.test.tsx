import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n.ts';
import { AdminDashboardPage } from '../src/pages/AdminDashboardPage.tsx';

/**
 * R284.5: the feedback queue joins no label to its value in code. Each line
 * is one key's text with its value, on the app's own i18n.
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
    feedback: vi.fn().mockResolvedValue([
      {
        feedback_id: 'f1',
        user_id: 'u1',
        feedback_type: 'Bug',
        user_message: 'The page broke.',
        structured_summary: 'A page broke.',
        context: {
          screen: 'echo-detail',
          echo_id: '0123456789abcdef',
          recent_events: [],
        },
        status: 'Resolved',
        priority: 'P2',
        github_issue_url: 'https://github.invalid/issues/1',
        resolution_notes: 'Fixed in the next build.',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-02T00:00:00Z',
      },
    ]),
  },
}));

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);

// A key whose English text equals what code once wrote is given other text
// for its test, so the test fails if the page writes the text itself.
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

async function openFeedbackQueue() {
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
    fireEvent.click(screen.getByRole('tab', { name: t('admin.tabFeedback') }));
  });
}

describe('the feedback queue (R284.5)', () => {
  it("shows each filter's first option as one key's text", async () => {
    await openFeedbackQueue();
    expect(
      screen.getByRole('option', { name: t('admin.feedbackTypeAll') }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: t('admin.feedbackStatusAll') }),
    ).toBeInTheDocument();
  });

  it("shows the screen and the Echo as one key's text each, with its value", async () => {
    overrideText('admin.feedbackEchoValue', 'Echo id {{echoId}}');
    await openFeedbackQueue();
    const line = screen.getByText((_, el) =>
      Boolean(
        el?.tagName === 'P' &&
        el.textContent ===
          `${t('admin.feedbackScreenValue', { screen: 'echo-detail' })} · ${t(
            'admin.feedbackEchoValue',
            { echoId: '01234567…' },
          )}`,
      ),
    );
    expect(line).toBeInTheDocument();
  });

  it("shows the resolution as one key's text with its value", async () => {
    await openFeedbackQueue();
    expect(
      screen.getByText(
        t('admin.resolutionValue', { notes: 'Fixed in the next build.' }),
      ),
    ).toBeInTheDocument();
  });

  it('names the GitHub issue link from its key (Rule 14)', async () => {
    overrideText('admin.feedbackGithubIssue', 'Open the issue');
    await openFeedbackQueue();
    expect(
      screen.getByRole('link', { name: t('admin.feedbackGithubIssue') }),
    ).toHaveAttribute('href', 'https://github.invalid/issues/1');
  });
});
