import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18next from 'i18next';

// Italian and Vietnamese locale imports are aliased (itIT, viVN) below to
// avoid shadowing vitest's `it` and `vi` globals.

type I18nInstance = ReturnType<typeof i18next.createInstance>;

import { AdaptiveLanguageSubheader } from '../src/components/AdaptiveLanguageSubheader.tsx';
import {
  detectShippedLocale,
  shuffle,
} from '../src/components/adaptiveLanguageSubheader.utils.ts';
import { CHOOSE_LANGUAGE_TITLES } from '../src/generated/choose-language-titles.ts';
import { SUPPORTED_LOCALES } from '../src/i18n.ts';

// Static imports of all 21 locale bundles. The production client lazy-loads
// non-English locales, but the component reads its slot text from the
// generated CHOOSE_LANGUAGE_TITLES map (no i18n bundle lookup). These raw
// imports power the phraseFor() helper used by assertions so test literals
// come from the canonical locale JSONs, not from a hand-maintained copy.
import en from '../src/locales/en.json';
import zhHans from '../src/locales/zh-Hans.json';
import zhHant from '../src/locales/zh-Hant.json';
import hi from '../src/locales/hi.json';
import es from '../src/locales/es.json';
import ar from '../src/locales/ar.json';
import fr from '../src/locales/fr.json';
import bn from '../src/locales/bn.json';
import ptBR from '../src/locales/pt-BR.json';
import ru from '../src/locales/ru.json';
import ur from '../src/locales/ur.json';
import id from '../src/locales/id.json';
import de from '../src/locales/de.json';
import ja from '../src/locales/ja.json';
import viVN from '../src/locales/vi.json';
import tr from '../src/locales/tr.json';
import ko from '../src/locales/ko.json';
import tl from '../src/locales/tl.json';
import itIT from '../src/locales/it.json';
import th from '../src/locales/th.json';
import ms from '../src/locales/ms.json';

const BUNDLES: Record<string, Record<string, unknown>> = {
  en, 'zh-Hans': zhHans, 'zh-Hant': zhHant, hi, es, ar, fr, bn,
  'pt-BR': ptBR, ru, ur, id, de, ja, vi: viVN, tr, ko, tl, it: itIT, th, ms,
};

// Canonical per-locale phrase lookup used by assertions. Reads from the
// shipped locale JSON directly so the test literal comes from the translation
// file, not from a hand-maintained hardcode.
function phraseFor(locale: keyof typeof BUNDLES): string {
  const bundle = BUNDLES[locale] as { onboarding?: { chooseLanguageTitle?: string } };
  const value = bundle.onboarding?.chooseLanguageTitle;
  if (typeof value !== 'string') {
    throw new Error(`Test setup: no chooseLanguageTitle in ${String(locale)}.json`);
  }
  return value;
}

function buildI18n(): I18nInstance {
  const instance = i18next.createInstance();
  void instance.use(initReactI18next).init({
    resources: {},
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    showSupportNotice: false,
  });
  for (const [locale, bundle] of Object.entries(BUNDLES)) {
    instance.addResourceBundle(locale, 'translation', bundle);
  }
  return instance;
}

function renderWith(instance: I18nInstance) {
  return render(
    <I18nextProvider i18n={instance}>
      <AdaptiveLanguageSubheader />
    </I18nextProvider>,
  );
}

function setNavLanguage(value: string): void {
  Object.defineProperty(navigator, 'language', {
    value,
    configurable: true,
  });
}

interface MockMediaQueryList {
  matches: boolean;
  media: string;
  onchange: ((e: MediaQueryListEvent) => void) | null;
  addEventListener: (
    type: string,
    handler: (e: MediaQueryListEvent) => void,
  ) => void;
  removeEventListener: (
    type: string,
    handler: (e: MediaQueryListEvent) => void,
  ) => void;
  addListener: (h: (e: MediaQueryListEvent) => void) => void;
  removeListener: (h: (e: MediaQueryListEvent) => void) => void;
  dispatchEvent: (e: MediaQueryListEvent) => boolean;
  _fire: (matches: boolean) => void;
}

function installMatchMedia(initialMatches: boolean): MockMediaQueryList {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql: MockMediaQueryList = {
    matches: initialMatches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: (_type, handler) => {
      listeners.add(handler);
    },
    removeEventListener: (_type, handler) => {
      listeners.delete(handler);
    },
    addListener: (h) => {
      listeners.add(h);
    },
    removeListener: (h) => {
      listeners.delete(h);
    },
    dispatchEvent: () => true,
    _fire: (matches: boolean) => {
      mql.matches = matches;
      const evt = { matches, media: mql.media } as MediaQueryListEvent;
      for (const h of listeners) h(evt);
    },
  };
  window.matchMedia = vi
    .fn()
    .mockImplementation(() => mql) as unknown as typeof window.matchMedia;
  return mql;
}

describe('detectShippedLocale', () => {
  it('returns exact shipped locale when matched', () => {
    expect(detectShippedLocale('zh-Hans')).toBe('zh-Hans');
    expect(detectShippedLocale('pt-BR')).toBe('pt-BR');
    expect(detectShippedLocale('ko')).toBe('ko');
  });

  it('strips region suffix for base-code matches', () => {
    expect(detectShippedLocale('en-US')).toBe('en');
    expect(detectShippedLocale('fr-CA')).toBe('fr');
    expect(detectShippedLocale('ko-KR')).toBe('ko');
  });

  it('maps Chinese region codes to script via heuristic', () => {
    expect(detectShippedLocale('zh-CN')).toBe('zh-Hans');
    expect(detectShippedLocale('zh-SG')).toBe('zh-Hans');
    expect(detectShippedLocale('zh-TW')).toBe('zh-Hant');
    expect(detectShippedLocale('zh-HK')).toBe('zh-Hant');
    expect(detectShippedLocale('zh-MO')).toBe('zh-Hant');
  });

  it('maps all Portuguese variants to pt-BR (only shipped variant)', () => {
    expect(detectShippedLocale('pt')).toBe('pt-BR');
    expect(detectShippedLocale('pt-PT')).toBe('pt-BR');
  });

  it('falls back to English for unshipped and empty inputs', () => {
    expect(detectShippedLocale('sw')).toBe('en');
    expect(detectShippedLocale('xx-YY')).toBe('en');
    expect(detectShippedLocale('')).toBe('en');
    expect(detectShippedLocale(null)).toBe('en');
    expect(detectShippedLocale(undefined)).toBe('en');
  });
});

describe('shuffle', () => {
  it('Fisher-Yates shuffle produces different orders under different RNGs', () => {
    // Two distinct seeded RNGs drive two distinct permutations of the same
    // source. If shuffle is deterministic w.r.t. its RNG, swapping the RNG
    // is sufficient to verify the output ordering changes.
    const source = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const rngA = mulberry32(1);
    const rngB = mulberry32(9999);
    const a = shuffle(source, rngA);
    const b = shuffle(source, rngB);
    expect(a).not.toEqual(b);
    // Both results are still permutations of the source.
    expect([...a].sort((x, y) => x - y)).toEqual(source);
    expect([...b].sort((x, y) => x - y)).toEqual(source);
  });

  it('does not mutate the input', () => {
    const source = [1, 2, 3, 4, 5];
    const snapshot = [...source];
    shuffle(source, mulberry32(42));
    expect(source).toEqual(snapshot);
  });
});

// Tiny seeded PRNG for test determinism. Not cryptographic.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('AdaptiveLanguageSubheader', () => {
  const originalMatchMedia = window.matchMedia;
  const originalLanguage = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(navigator),
    'language',
  );

  beforeEach(() => {
    installMatchMedia(false);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    if (originalLanguage) {
      Object.defineProperty(
        Object.getPrototypeOf(navigator),
        'language',
        originalLanguage,
      );
    }
    vi.useRealTimers();
  });

  it('renders slot 1 with the detected browser locale when shipped', async () => {
    setNavLanguage('ko-KR');
    const i18n = buildI18n();
    await act(async () => {
      renderWith(i18n);
    });
    const slot1 = screen.getByTestId('adaptive-language-subheader').querySelector(
      '[data-slot="1"]',
    );
    expect(slot1).not.toBeNull();
    expect(slot1?.getAttribute('lang')).toBe('ko');
    expect(slot1?.textContent).toBe(phraseFor('ko'));
  });

  it('falls back to English in slot 1 when detected locale is not shipped', async () => {
    setNavLanguage('sw-TZ'); // Swahili — not in SUPPORTED_LOCALES.
    const i18n = buildI18n();
    await act(async () => {
      renderWith(i18n);
    });
    const slot1 = screen.getByTestId('adaptive-language-subheader').querySelector(
      '[data-slot="1"]',
    );
    expect(slot1?.getAttribute('lang')).toBe('en');
    expect(slot1?.textContent).toBe(phraseFor('en'));
  });

  it('advances slots 2 and 3 on a 1-second interval', async () => {
    vi.useFakeTimers();
    setNavLanguage('en');
    const i18n = buildI18n();
    await act(async () => {
      renderWith(i18n);
    });
    const bar = screen.getByTestId('adaptive-language-subheader');
    const slot2 = bar.querySelector('[data-slot="2"]');
    const slot3 = bar.querySelector('[data-slot="3"]');
    const initialSlot2 = slot2?.textContent;
    const initialSlot3 = slot3?.textContent;

    // Advance one full rotation cycle (1s interval + 300ms fade swap).
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });
    const afterOneTickSlot2 = bar.querySelector('[data-slot="2"]')?.textContent;
    const afterOneTickSlot3 = bar.querySelector('[data-slot="3"]')?.textContent;
    expect(afterOneTickSlot2).not.toBe(initialSlot2);
    expect(afterOneTickSlot3).not.toBe(initialSlot3);

    // Advance a second cycle — slots should change again.
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });
    const afterTwoTicksSlot2 = bar.querySelector('[data-slot="2"]')?.textContent;
    expect(afterTwoTicksSlot2).not.toBe(afterOneTickSlot2);
  });

  it('never shows slot 1 locale in slots 2 or 3 across many ticks', async () => {
    vi.useFakeTimers();
    setNavLanguage('es-ES');
    const i18n = buildI18n();
    await act(async () => {
      renderWith(i18n);
    });
    const bar = screen.getByTestId('adaptive-language-subheader');
    const slot1Lang = bar.querySelector('[data-slot="1"]')?.getAttribute('lang');
    expect(slot1Lang).toBe('es');

    for (let i = 0; i < 30; i++) {
      const s2 = bar.querySelector('[data-slot="2"]')?.getAttribute('lang');
      const s3 = bar.querySelector('[data-slot="3"]')?.getAttribute('lang');
      expect(s2).not.toBe(slot1Lang);
      expect(s3).not.toBe(slot1Lang);
      await act(async () => {
        vi.advanceTimersByTime(1300);
      });
    }
  });

  it('renders static three-phrase version with no rotation under reduced motion', async () => {
    installMatchMedia(true); // prefers-reduced-motion = reduce
    vi.useFakeTimers();
    setNavLanguage('en');
    const i18n = buildI18n();
    await act(async () => {
      renderWith(i18n);
    });
    const bar = screen.getByTestId('adaptive-language-subheader');
    const initialSlot2 = bar.querySelector('[data-slot="2"]')?.textContent;
    const initialSlot3 = bar.querySelector('[data-slot="3"]')?.textContent;

    // Reduced-motion fallback for slot1='en': slot 2 = zh-Hans, slot 3 = hi.
    expect(initialSlot2).toBe(phraseFor('zh-Hans'));
    expect(initialSlot3).toBe(phraseFor('hi'));

    // Advance several seconds — phrases must stay locked.
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(bar.querySelector('[data-slot="2"]')?.textContent).toBe(initialSlot2);
    expect(bar.querySelector('[data-slot="3"]')?.textContent).toBe(initialSlot3);
  });

  it('swaps to reduced-motion mode when the media query flips after mount', async () => {
    vi.useFakeTimers();
    setNavLanguage('en');
    const mql = installMatchMedia(false);
    const i18n = buildI18n();
    await act(async () => {
      renderWith(i18n);
    });

    // Pre-flip: rotation is running — slot 2 should change after a tick.
    const bar = screen.getByTestId('adaptive-language-subheader');
    const preFlipSlot2 = bar.querySelector('[data-slot="2"]')?.textContent;
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });
    const afterOneTick = bar.querySelector('[data-slot="2"]')?.textContent;
    expect(afterOneTick).not.toBe(preFlipSlot2);

    // Flip the query to reduce — rotation must halt and fallback must render.
    await act(async () => {
      mql._fire(true);
    });
    const afterFlipSlot2 = bar.querySelector('[data-slot="2"]')?.textContent;
    expect(afterFlipSlot2).toBe(phraseFor('zh-Hans'));

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(bar.querySelector('[data-slot="2"]')?.textContent).toBe(
      phraseFor('zh-Hans'),
    );
  });

  it('visits every non-slot-1 locale across enough ticks (coverage check)', async () => {
    vi.useFakeTimers();
    setNavLanguage('en');
    const i18n = buildI18n();
    await act(async () => {
      renderWith(i18n);
    });
    const bar = screen.getByTestId('adaptive-language-subheader');
    const seen = new Set<string>();

    // Rotation length is 20; lockstep advance of 2 visits all 20 in 10 ticks.
    // Sample slots 2 and 3 over 20 ticks to guarantee full coverage even
    // across the wrap-around.
    for (let i = 0; i < 20; i++) {
      const s2 = bar.querySelector('[data-slot="2"]')?.getAttribute('lang');
      const s3 = bar.querySelector('[data-slot="3"]')?.getAttribute('lang');
      if (s2) seen.add(s2);
      if (s3) seen.add(s3);
      await act(async () => {
        vi.advanceTimersByTime(1300);
      });
    }

    const expected = SUPPORTED_LOCALES.filter((l) => l !== 'en');
    for (const locale of expected) {
      expect(seen.has(locale)).toBe(true);
    }
  });

  it('sets dir="rtl" on Arabic and Urdu phrases within LTR-arranged slots', async () => {
    vi.useFakeTimers();
    setNavLanguage('ar');
    const i18n = buildI18n();
    await act(async () => {
      renderWith(i18n);
    });
    const bar = screen.getByTestId('adaptive-language-subheader');

    // Slot 1 is Arabic — should render RTL within an LTR-arranged bar.
    expect(bar.getAttribute('dir')).toBe('ltr');
    const slot1 = bar.querySelector('[data-slot="1"]');
    expect(slot1?.getAttribute('dir')).toBe('rtl');
    expect(slot1?.getAttribute('lang')).toBe('ar');
    expect(slot1?.textContent).toBe(phraseFor('ar'));

    // Scan rotation for urdu slot — should also be dir="rtl".
    let urduSeen = false;
    for (let i = 0; i < 20; i++) {
      const slots = [
        bar.querySelector('[data-slot="2"]'),
        bar.querySelector('[data-slot="3"]'),
      ];
      for (const s of slots) {
        if (s?.getAttribute('lang') === 'ur') {
          expect(s?.getAttribute('dir')).toBe('rtl');
          urduSeen = true;
        }
      }
      await act(async () => {
        vi.advanceTimersByTime(1300);
      });
    }
    expect(urduSeen).toBe(true);
  });

  it('marks rotating slots aria-hidden so screen readers only hear slot 1', async () => {
    setNavLanguage('fr');
    const i18n = buildI18n();
    await act(async () => {
      renderWith(i18n);
    });
    const bar = screen.getByTestId('adaptive-language-subheader');
    expect(bar.querySelector('[data-slot="1"]')?.getAttribute('aria-hidden')).toBeNull();
    expect(bar.querySelector('[data-slot="2"]')?.getAttribute('aria-hidden')).toBe('true');
    expect(bar.querySelector('[data-slot="3"]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('inline titles table matches every locale JSON onboarding.chooseLanguageTitle', () => {
    // Parity guard for the generated inline map. Duplicates the pre-commit
    // check in-process so a test run catches drift even if the generator
    // is not rerun. The component reads translations from
    // CHOOSE_LANGUAGE_TITLES; if that map diverges from the canonical
    // locale JSONs, every visitor sees a stale or wrong greeting.
    for (const locale of Object.keys(BUNDLES)) {
      expect(CHOOSE_LANGUAGE_TITLES[locale as keyof typeof CHOOSE_LANGUAGE_TITLES]).toBe(
        phraseFor(locale as keyof typeof BUNDLES),
      );
    }
  });

  it('renders slot 1 in the detected locale on the FIRST render — no English intermediate (FOUC guard)', async () => {
    // FOUC regression guard. Before the inline-titles refactor, the
    // component used i18n.getFixedT which falls back to 'en' until the
    // detected locale's bundle finishes lazy-loading — Korean visitors saw
    // "Choose your language" for ~200 ms on the landing page. This test
    // renders with an i18n instance that has NO non-English bundle seeded,
    // so a bundle-dependent implementation would be forced into the English
    // fallback; the inline-titles path must render Korean immediately.
    setNavLanguage('ko-KR');
    const bareI18n = i18next.createInstance();
    void bareI18n.use(initReactI18next).init({
      resources: { en: { translation: { onboarding: { chooseLanguageTitle: 'Choose your language' } } } },
      lng: 'en',
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      showSupportNotice: false,
    });
    await act(async () => {
      render(
        <I18nextProvider i18n={bareI18n}>
          <AdaptiveLanguageSubheader />
        </I18nextProvider>,
      );
    });
    const slot1 = screen.getByTestId('adaptive-language-subheader').querySelector(
      '[data-slot="1"]',
    );
    expect(slot1?.getAttribute('lang')).toBe('ko');
    expect(slot1?.textContent).toBe(phraseFor('ko'));
    // Specifically assert it's NOT the English fallback string.
    expect(slot1?.textContent).not.toBe('Choose your language');
  });

  it('applies the me-adaptive-slot min-inline-size class to all three slots', async () => {
    // Happy-dom cannot run a CSS layout engine, so we cannot assert the
    // rendered pixel width. We can assert that every slot carries the
    // `me-adaptive-slot` class — the single-source-of-truth for the
    // min-inline-size: 14ch layout-stability guard defined in
    // client/src/styles/global.css. If a future edit drops the class, the
    // minimum width is gone and rotation will visibly pulse the paragraph.
    setNavLanguage('en');
    const i18n = buildI18n();
    await act(async () => {
      renderWith(i18n);
    });
    const bar = screen.getByTestId('adaptive-language-subheader');
    for (const slot of ['1', '2', '3']) {
      const el = bar.querySelector(`[data-slot="${slot}"]`);
      expect(el?.className.split(/\s+/)).toContain('me-adaptive-slot');
    }
  });

  it('holds slot 1 stable across the session (no layout shift of the pinned slot)', async () => {
    vi.useFakeTimers();
    setNavLanguage('ja-JP');
    const i18n = buildI18n();
    await act(async () => {
      renderWith(i18n);
    });
    const bar = screen.getByTestId('adaptive-language-subheader');
    const pinned = bar.querySelector('[data-slot="1"]')?.textContent;
    expect(pinned).toBe(phraseFor('ja'));

    for (let i = 0; i < 15; i++) {
      await act(async () => {
        vi.advanceTimersByTime(1300);
      });
      expect(bar.querySelector('[data-slot="1"]')?.textContent).toBe(pinned);
    }
  });
});
