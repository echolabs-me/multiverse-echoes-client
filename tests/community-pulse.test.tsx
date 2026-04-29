import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { CommunityPulseCard } from '../src/components/CommunityPulseCard.tsx';

/**
 * β-2 scope: asserts CommunityPulseCard's actual current contract at the
 * component boundary. The old dashboard-feed.test.tsx asserted a
 * "title + empty-state" UX that no longer exists — CommunityPulseCard
 * returns null when there are no items to display (see
 * CommunityPulseCard.tsx:57), and the heading is owned by AppLayout's
 * aside wrapper (AppLayout.tsx:294/309/492). This file tests what the
 * component actually renders today.
 *
 * Known coverage gap (deferred to a dedicated commit after Part B #6):
 * `t('communityFeed.title')` rendering in AppLayout is not covered
 * anywhere. Source: AppLayout.tsx:294, :309, :492.
 */

const stableEchoList = [
  { echo_id: 'e1', name: 'Alice', current_mood: 'happy' },
  { echo_id: 'e2', name: 'Bob', current_mood: 'calm' },
];

vi.mock('../src/stores/useEchoStore.ts', () => ({
  useEchoStore: () => ({ echoList: stableEchoList }),
}));

const mockPersonalFeed = vi.fn();
const mockShardsGet = vi.fn().mockResolvedValue({ name: 'Stub Shard' });

vi.mock('../src/lib/api/endpoints.ts', () => ({
  feeds: {
    personal: (...args: unknown[]) => mockPersonalFeed(...args),
  },
  shards: {
    get: (...args: unknown[]) => mockShardsGet(...args),
  },
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        // communityFeed.* keys actually rendered by CommunityPulseCard.
        // The component never renders `title` or any `empty` key — those
        // were UI concerns of the old dashboard page and now live in
        // AppLayout (title only — see known-gap note above).
        'communityFeed.justNow': 'just now',
        'communityFeed.minutesAgo': '{{count}}m ago',
        'communityFeed.hoursAgo': '{{count}}h ago',
        'communityFeed.daysAgo': '{{count}}d ago',
        'communityFeed.exploringShard': 'Exploring {{shard}}',
        'communityFeed.goingAboutDay': 'Going about their day',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderCard() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <CommunityPulseCard />
    </I18nextProvider>,
  );
}

describe('CommunityPulseCard', () => {
  beforeEach(() => {
    mockPersonalFeed.mockReset();
    mockShardsGet.mockReset();
    mockShardsGet.mockResolvedValue({ name: 'Stub Shard' });
  });

  it('returns null when feeds.personal returns an empty list', async () => {
    // CommunityPulseCard.tsx:57 — if (display.length === 0) return null.
    // No items in the pulse means the component renders nothing, rather
    // than an "empty" message. The null-on-empty contract must survive
    // so that AppLayout's aside wrapper can choose its own empty UX.
    mockPersonalFeed.mockResolvedValue({ data: [], next_cursor: null });
    let result: ReturnType<typeof renderCard>;
    await act(async () => {
      result = renderCard();
    });
    // renderCard's container has a single root <div> from Testing Library;
    // CommunityPulseCard returning null means that root has no children.
    expect(result!.container.firstChild).toBeNull();
  });

  it('renders feed items when feeds.personal returns data', async () => {
    // With non-empty data, CommunityPulseCard.tsx:61-122 renders one row
    // per item. Assert that at least one of the provided items' text
    // surfaces in the DOM. Uses a life_event item because the component
    // prioritises events over diary entries (line 48).
    mockPersonalFeed.mockResolvedValue({
      data: [
        {
          item_id: 'i1',
          item_type: 'life_event',
          echo_id: 'e1',
          shard_id: 's1',
          title: 'Alice changed jobs',
          body: 'A new chapter starts.',
          significance: 0.7,
          tick_id: 1,
          created_at: new Date().toISOString(),
          is_public: true,
        },
      ],
      next_cursor: null,
    });
    await act(async () => {
      renderCard();
    });
    expect(await screen.findByText('Alice changed jobs')).toBeInTheDocument();
    // Echo name ('Alice') is rendered alongside the title row
    // (CommunityPulseCard.tsx:105 renders echoName in a <span>).
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
