import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES, RTL_LOCALES, type SupportedLocale } from '../i18n.ts';
import { useReducedMotion } from '../hooks/useReducedMotion.ts';
import {
  detectShippedLocale,
  shuffle,
  staticFallbackSlots,
} from './adaptiveLanguageSubheader.utils.ts';

const CHOOSE_LANGUAGE_KEY = 'onboarding.chooseLanguageTitle';
const ROTATION_INTERVAL_MS = 1000;
const FADE_MS = 300;

/**
 * Adaptive rotating subheader for the language-selection entry page.
 *
 * Layout: three centred phrases separated by middle-dot (U+00B7). Slot 1 is
 * pinned to the visitor's detected browser locale for the session; slots 2
 * and 3 rotate lockstep through the remaining 20 shipped locales on a 1s
 * cadence.
 *
 * Advance pattern — LOCKSTEP (cursor += 2 per tick). Both rotating slots
 * swap on the same tick, visiting all 20 non-pinned locales in 10 ticks.
 * Staggered advance at a 1s cadence felt listless in review; lockstep
 * delivers steady visual rhythm without overwhelming the eye.
 *
 * Layout stability — each rotating slot has `min-inline-size: 14ch` via the
 * `me-adaptive-slot` class in global.css, sized to the majority of the 20
 * phrases. A handful of Latin-diacritic phrases (German / Vietnamese) push a
 * few ch beyond that min; the paragraph is `text-align: center` with natural
 * inline flow, so the small pulse only affects the paragraph's own edges
 * (the flag circle below sits in a fixed-size container unaffected by
 * subheader width). Approach chosen over JS measurement because it keeps
 * hydration deterministic and handles the mobile wrap case for free.
 *
 * Mobile — on viewports narrower than the three-slot line, the inline-flex
 * slots wrap naturally onto additional lines. Below ~380px, the middle-dot
 * separators keep the slots legibly grouped. No special breakpoint handling
 * required because text flow does the right thing.
 *
 * RTL — the bar itself is LTR (slot 1 left, slot 3 right) so the visitor's
 * greeting is always leftmost regardless of page direction; individual
 * phrase spans set `dir="rtl"` for Arabic and Urdu so glyphs render in their
 * natural flow within the slot.
 *
 * Accessibility — slot 1 is stable and part of the accessible name; slots 2
 * and 3 rotate and carry `aria-hidden="true"` so screen readers aren't
 * interrupted every second. The <p> has no aria-live because only the
 * stable slot 1 is announced.
 *
 * Hydration — initial slot-1 value is 'en' on both server and client; a
 * useEffect runs post-mount to swap in the detected locale, avoiding any
 * hydration-mismatch warning from the prerender path.
 */
export function AdaptiveLanguageSubheader() {
  const { i18n } = useTranslation();
  const reduced = useReducedMotion();

  const [slot1Locale, setSlot1Locale] = useState<SupportedLocale>('en');
  useEffect(() => {
    const applyDetectedLocale = () => {
      if (typeof navigator === 'undefined') return;
      setSlot1Locale(detectShippedLocale(navigator.language));
    };
    applyDetectedLocale();
  }, []);

  const rotation = useMemo<readonly SupportedLocale[]>(() => {
    const others = (SUPPORTED_LOCALES as readonly SupportedLocale[]).filter(
      (l) => l !== slot1Locale,
    );
    return shuffle(others);
  }, [slot1Locale]);

  const [bundlesReady, setBundlesReady] = useState(() =>
    (SUPPORTED_LOCALES as readonly string[]).every((l) =>
      i18n.hasResourceBundle(l, 'translation'),
    ),
  );
  useEffect(() => {
    if (bundlesReady) return;
    let cancelled = false;
    void i18n.loadLanguages([...SUPPORTED_LOCALES]).then(() => {
      if (!cancelled) setBundlesReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [bundlesReady, i18n]);

  const [cursor, setCursor] = useState(0);
  const [fading, setFading] = useState(false);
  const swapTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (reduced || !bundlesReady) return undefined;
    const intervalId = setInterval(() => {
      setFading(true);
      swapTimerRef.current = setTimeout(() => {
        setCursor((c) => (c + 2) % rotation.length);
        setFading(false);
      }, FADE_MS);
    }, ROTATION_INTERVAL_MS);
    return () => {
      clearInterval(intervalId);
      if (swapTimerRef.current !== undefined) {
        clearTimeout(swapTimerRef.current);
        swapTimerRef.current = undefined;
      }
    };
  }, [reduced, bundlesReady, rotation.length]);

  const translateFor = (locale: SupportedLocale): string => {
    const source = i18n.hasResourceBundle(locale, 'translation') ? locale : 'en';
    return i18n.getFixedT(source, 'translation')(CHOOSE_LANGUAGE_KEY);
  };

  const [staticSlot2, staticSlot3] = staticFallbackSlots(slot1Locale);
  const slot2Locale: SupportedLocale = reduced
    ? staticSlot2
    : (rotation[cursor] ?? 'en');
  const slot3Locale: SupportedLocale = reduced
    ? staticSlot3
    : (rotation[(cursor + 1) % rotation.length] ?? 'en');

  const rtlSet = RTL_LOCALES as readonly string[];
  const dirFor = (l: SupportedLocale): 'rtl' | 'ltr' =>
    rtlSet.includes(l) ? 'rtl' : 'ltr';

  const rotatingOpacity = fading && !reduced ? 'opacity-0' : 'opacity-100';

  return (
    <p
      className="me-fade-up mbe-8 text-center font-serif text-lg font-light tracking-wide text-[#9BA5AE]"
      data-delay="150"
      data-testid="adaptive-language-subheader"
      dir="ltr"
    >
      <span
        lang={slot1Locale}
        dir={dirFor(slot1Locale)}
        data-slot="1"
        className="me-adaptive-slot inline-block"
      >
        {translateFor(slot1Locale)}
      </span>
      <span aria-hidden="true">&ensp;&middot;&ensp;</span>
      <span
        lang={slot2Locale}
        dir={dirFor(slot2Locale)}
        data-slot="2"
        aria-hidden="true"
        className={`me-adaptive-slot inline-block transition-opacity duration-300 ${rotatingOpacity}`}
      >
        {translateFor(slot2Locale)}
      </span>
      <span aria-hidden="true">&ensp;&middot;&ensp;</span>
      <span
        lang={slot3Locale}
        dir={dirFor(slot3Locale)}
        data-slot="3"
        aria-hidden="true"
        className={`me-adaptive-slot inline-block transition-opacity duration-300 ${rotatingOpacity}`}
      >
        {translateFor(slot3Locale)}
      </span>
    </p>
  );
}
