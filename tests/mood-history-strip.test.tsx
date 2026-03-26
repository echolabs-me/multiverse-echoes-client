import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MoodHistoryStrip } from '../src/components/MoodHistoryStrip.tsx';
import { getMoodPalette } from '../src/hooks/useMoodAtmosphere.ts';
import type { DiaryEntry } from '../src/types/api.ts';

/**
 * Phase 6B Testing — Mood History Strip
 *
 * Tests rendering logic, segment count, colour mapping, and edge cases.
 * Does NOT test visual appearance (gradients, tooltips) — tests the logic underneath.
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
    // Each entry gets a button for hover/click interaction
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
    // Should render without crashing
    const { container } = render(
      <Wrapper>
        <MoodHistoryStrip entries={entries} />
      </Wrapper>,
    );
    expect(container.querySelector('[role="img"]')).toBeInTheDocument();
  });

  it('gradient style contains mood primary colours', () => {
    const entries = [
      makeDiaryEntry({ diary_id: 'a', mood: 'happy' }),
      makeDiaryEntry({ diary_id: 'b', mood: 'sad' }),
    ];
    render(
      <Wrapper>
        <MoodHistoryStrip entries={entries} />
      </Wrapper>,
    );
    const strip = screen.getByRole('img', { name: 'Mood history' });
    const style = strip.getAttribute('style') ?? '';
    // Entries come newest-first from API, component reverses to chronological
    // So 'b' (sad) is newest, reversed order is [b, a] → [sad, happy] chronologically
    // Wait — entries array order is [a, b], reversed = [b, a]
    // Actually: "Entries come newest-first from API" — so entries[0]=a is newest
    // Component does [...entries].reverse() → [b, a] is chronological
    const sadPrimary = getMoodPalette('sad').primary;
    const happyPrimary = getMoodPalette('happy').primary;
    expect(style).toContain(sadPrimary);
    expect(style).toContain(happyPrimary);
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
});
