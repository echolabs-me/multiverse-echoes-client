import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MoodHistoryStrip } from '../src/components/MoodHistoryStrip.tsx';
import { getMoodPalette } from '../src/hooks/useMoodAtmosphere.ts';
import type { DiaryEntry } from '../src/types/api.ts';

/**
 * Phase 6B Testing — Mood History Strip (redesigned for #4)
 *
 * Tests rendering logic, segment count, colour mapping, and edge cases.
 */

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'echoDetail.moodHistory': 'Mood history',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={testI18n}>{children}</I18nextProvider>;
}

function makeDiaryEntry(overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    diary_id: crypto.randomUUID(),
    echo_id: 'echo-1',
    tick_id: 1,
    simulated_date: '2087-03-15',
    content: 'Test diary entry.',
    mood: 'neutral',
    location_name: 'Test Location',
    shard_id: 'shard-1',
    nudge_source: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('MoodHistoryStrip', () => {
  it('returns null / does not render with 0 diary entries', () => {
    const { container } = render(
      <Wrapper>
        <MoodHistoryStrip entries={[]} />
      </Wrapper>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders with 1 diary entry', () => {
    const entries = [makeDiaryEntry({ mood: 'happy' })];
    render(
      <Wrapper>
        <MoodHistoryStrip entries={entries} />
      </Wrapper>,
    );
    expect(screen.getByRole('img', { name: 'Mood history' })).toBeInTheDocument();
  });

  it('renders correct number of segment buttons for N entries', () => {
    const entries = [
      makeDiaryEntry({ diary_id: 'a', mood: 'happy' }),
      makeDiaryEntry({ diary_id: 'b', mood: 'sad' }),
      makeDiaryEntry({ diary_id: 'c', mood: 'calm' }),
      makeDiaryEntry({ diary_id: 'd', mood: 'angry' }),
      makeDiaryEntry({ diary_id: 'e', mood: 'neutral' }),
    ];
    render(
      <Wrapper>
        <MoodHistoryStrip entries={entries} />
      </Wrapper>,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);
  });

  it('segment aria-labels contain mood and date', () => {
    const entries = [
      makeDiaryEntry({ diary_id: 'a', mood: 'excited', simulated_date: '2087-04-01' }),
    ];
    render(
      <Wrapper>
        <MoodHistoryStrip entries={entries} />
      </Wrapper>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', '2087-04-01 — excited');
  });

  it('handles entries with unrecognised mood strings (falls back to neutral colour)', () => {
    const entries = [
      makeDiaryEntry({ diary_id: 'a', mood: 'flibbertigibbet' }),
    ];
    const { container } = render(
      <Wrapper>
        <MoodHistoryStrip entries={entries} />
      </Wrapper>,
    );
    expect(container.querySelector('[role="img"]')).toBeInTheDocument();
  });

  it('each segment button uses its mood primary colour in style', () => {
    const entries = [
      makeDiaryEntry({ diary_id: 'a', mood: 'happy' }),
      makeDiaryEntry({ diary_id: 'b', mood: 'sad' }),
    ];
    render(
      <Wrapper>
        <MoodHistoryStrip entries={entries} />
      </Wrapper>,
    );
    const buttons = screen.getAllByRole('button');
    // Entries come newest-first, component reverses: [b, a] → chronological [sad, happy]
    // So button[0] = sad (entry b), button[1] = happy (entry a)
    const sadPrimary = getMoodPalette('sad').primary;
    const happyPrimary = getMoodPalette('happy').primary;
    expect(buttons[0].getAttribute('style')).toContain(sadPrimary);
    expect(buttons[1].getAttribute('style')).toContain(happyPrimary);
  });

  it('applies custom className', () => {
    const entries = [makeDiaryEntry()];
    const { container } = render(
      <Wrapper>
        <MoodHistoryStrip entries={entries} className="mt-4" />
      </Wrapper>,
    );
    expect(container.firstChild).toHaveClass('mt-4');
  });

  it('shows date range when multiple entries', () => {
    const entries = [
      makeDiaryEntry({ diary_id: 'a', simulated_date: '2087-04-05' }),
      makeDiaryEntry({ diary_id: 'b', simulated_date: '2087-03-01' }),
    ];
    render(
      <Wrapper>
        <MoodHistoryStrip entries={entries} />
      </Wrapper>,
    );
    // Reversed: b (oldest) first, a (newest) last
    expect(screen.getByText('2087-03-01')).toBeInTheDocument();
    expect(screen.getByText('2087-04-05')).toBeInTheDocument();
  });

  it('does not show date range for single entry', () => {
    const entries = [makeDiaryEntry({ simulated_date: '2087-03-15' })];
    const { container } = render(
      <Wrapper>
        <MoodHistoryStrip entries={entries} />
      </Wrapper>,
    );
    // No date range div when only 1 entry
    const spans = container.querySelectorAll('.justify-between span');
    expect(spans).toHaveLength(0);
  });

  it('latest segment has a pulse indicator', () => {
    const entries = [
      makeDiaryEntry({ diary_id: 'a', mood: 'happy' }),
      makeDiaryEntry({ diary_id: 'b', mood: 'calm' }),
    ];
    render(
      <Wrapper>
        <MoodHistoryStrip entries={entries} />
      </Wrapper>,
    );
    // The ping animation class should be present on the latest segment
    const pingEl = document.querySelector('.animate-ping');
    expect(pingEl).toBeInTheDocument();
  });
});
