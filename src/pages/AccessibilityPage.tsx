import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';

export function AccessibilityPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  // Legal-ish documents stay English-only until reviewed by a native
  // translator (CC TASK 4 Part G Step 23).
  const showEnglishOnlyBanner = i18n.language !== 'en';

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="mx-auto w-full max-w-3xl p-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>

        {showEnglishOnlyBanner && (
          <div
            className="mb-6 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-text-secondary"
            role="note"
          >
            {t('common.legalDocsEnglishOnly')}
          </div>
        )}

        <h1 className="mb-2 text-3xl font-bold text-text-primary">Accessibility Statement</h1>
        <p className="mb-8 text-sm text-text-muted">Last updated: 31 March 2026</p>

        <div className="flex flex-col gap-6 text-sm leading-relaxed text-text-secondary">

          {/* Commitment */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">Our commitment</h2>
            <p>
              Multiverse Echoes is committed to making our platform accessible to everyone. We target
              conformance with the{' '}
              <strong>Web Content Accessibility Guidelines (WCAG) 2.1 Level AA</strong> standard.
              Accessibility is not an afterthought &mdash; it is integrated into our design system,
              component library, and testing pipeline from the start.
            </p>
          </section>

          {/* What we've done */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">What we&apos;ve done</h2>
            <ul className="list-disc space-y-2 ps-5">
              <li>
                <strong>Keyboard navigation</strong> &mdash; All interactive elements are reachable
                via Tab key. Focus indicators are visible (2px accent outline). Skip links are provided
                to bypass navigation. Logical tab order is maintained throughout.
              </li>
              <li>
                <strong>Screen reader support</strong> &mdash; Semantic HTML (headings, lists, tables,
                landmarks) is used throughout. All images have descriptive alt text. Interactive elements
                have ARIA labels. Dynamic content updates are announced via <code>aria-live</code> regions.
              </li>
              <li>
                <strong>Colour contrast</strong> &mdash; All text and interactive elements meet WCAG 2.1 AA
                contrast ratios (4.5:1 for normal text, 3:1 for large text). Information is never conveyed
                by colour alone.
              </li>
              <li>
                <strong>Reduced motion</strong> &mdash; All animations respect the{' '}
                <code>prefers-reduced-motion</code> operating system setting. When enabled, animations
                are disabled or replaced with static alternatives. The Echo birth animation shows a
                static screen. The tick pulse is disabled entirely.
              </li>
              <li>
                <strong>Touch targets</strong> &mdash; All interactive elements meet the minimum 44x44px
                touch target size.
              </li>
              <li>
                <strong>Text scaling</strong> &mdash; The interface remains usable at 200% browser zoom
                without horizontal scrolling or content cutoff.
              </li>
              <li>
                <strong>Dark and light modes</strong> &mdash; Both colour schemes are designed with
                contrast-tested palettes. Users can choose their preference in Settings.
              </li>
              <li>
                <strong>Automated testing</strong> &mdash; We run axe-core accessibility audits on all
                pages as part of our end-to-end test suite. Zero critical or serious violations are
                permitted.
              </li>
            </ul>
          </section>

          {/* 3D content */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">3D content and alternatives</h2>
            <p>
              Some features include 3D visualisations (Echo portraits, Shard environments). These
              are always accompanied by 2D fallbacks for devices that do not support WebGL, or when
              reduced motion is enabled. No information is conveyed exclusively through 3D content.
            </p>
          </section>

          {/* Audio */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">Audio</h2>
            <p>
              Sound effects are optional and disabled by default. No information is conveyed through
              audio alone &mdash; all notifications have visual indicators. Sound can be toggled
              and volume adjusted in Settings.
            </p>
          </section>

          {/* Known gaps */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">Known gaps</h2>
            <p className="mb-2">We are aware of the following areas where we have not yet achieved full compliance:</p>
            <ul className="list-disc space-y-1 ps-5">
              <li>
                <strong>Manual screen reader testing</strong> &mdash; We have automated testing with
                axe-core but have not yet completed comprehensive manual testing with NVDA, JAWS,
                or VoiceOver. This is planned before public launch.
              </li>
              <li>
                <strong>Video captions</strong> &mdash; Video export features (highlight reels) do not
                yet include captions. This will be addressed when video features launch.
              </li>
              <li>
                <strong>Right-to-left (RTL) languages</strong> &mdash; The interface uses CSS logical
                properties in preparation for RTL support, but RTL layout has not yet been fully tested.
              </li>
              <li>
                <strong>Languages beyond English</strong> &mdash; Currently only English is supported.
                Additional languages are planned post-launch. The internationalisation architecture is
                in place (632 externalised strings).
              </li>
            </ul>
          </section>

          {/* Feedback */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">Feedback and contact</h2>
            <p>
              If you encounter an accessibility barrier or have suggestions for improvement, please
              contact us:
            </p>
            <ul className="mt-2 list-disc ps-5">
              <li>
                Email:{' '}
                <a href="mailto:conduct@echolabsme.com" className="text-accent hover:text-accent-hover">
                  conduct@echolabsme.com
                </a>
              </li>
              <li>In-app: use the Oracle assistant or the feedback form in Settings</li>
            </ul>
            <p className="mt-2">
              We take accessibility feedback seriously and aim to respond within 5 business days.
            </p>
          </section>

          {/* Conformance status */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">Conformance status</h2>
            <p>
              Multiverse Echoes is <strong>partially conformant</strong> with WCAG 2.1 Level AA.
              &ldquo;Partially conformant&rdquo; means that some parts of the content do not fully
              conform to the accessibility standard, as outlined in the Known Gaps section above.
              We are actively working to resolve these gaps.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
