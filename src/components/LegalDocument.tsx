/**
 * Generic renderer for the /legal JSON docs (Terms, Privacy, Accessibility).
 *
 * Source files live in `src/content/legal/{doc}.{locale}.json` and follow
 * a block-typed schema (see types below). Non-English bodies are generated
 * by `scripts/translate-legal.py` via the Gemma 4 sidecar; zh-Hant is
 * derived from zh-Hans via OpenCC s2hk.
 *
 * Loading is lazy per (doc, locale) pair via `import.meta.glob` so each
 * document × locale gets its own Vite code-split chunk, matching the
 * same pattern i18n locales use. English fallback is eager-loaded from
 * the sync map for zero first-paint lag on the dominant locale.
 *
 * Inline formatting inside block text strings:
 *   **bold**         -> <strong>
 *   [text](url)      -> <a href="url"> (external links open _blank)
 *   `code`           -> <code>
 *
 * For prerender: the component sets `window.__legalDocReady = "{doc}-{locale}"`
 * after the target JSON has applied, and renders `data-legal-loaded="true"`
 * on the outer `<article>` so Playwright's `waitForSelector` can confirm
 * content is present before capture.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft } from 'lucide-react';
import enTerms from '../content/legal/terms.en.json';
import enPrivacy from '../content/legal/privacy.en.json';
import enAccessibility from '../content/legal/accessibility.en.json';

export type LegalDocName = 'terms' | 'privacy' | 'accessibility';

type Block =
  | { type: 'p'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'callout'; blocks: Block[] }
  | { type: 'table'; columns: string[]; rows: string[][] };

interface LegalDoc {
  title: string;
  lastUpdated: string;
  sections: Array<{
    heading: string;
    blocks: Block[];
  }>;
}

/** Eager-loaded English fallback — zero first-paint gap for the dominant
 *  locale and the guaranteed source of truth when translations are missing. */
const EN_FALLBACKS: Record<LegalDocName, LegalDoc> = {
  terms: enTerms as LegalDoc,
  privacy: enPrivacy as LegalDoc,
  accessibility: enAccessibility as LegalDoc,
};

/** Lazy loaders for every (doc, locale) pair. Vite inspects the glob at
 *  build time and emits one chunk per matched file. At runtime, we resolve
 *  `../content/legal/{doc}.{locale}.json` and await the loader. */
const legalLoaders = import.meta.glob('../content/legal/*.json') as Record<
  string,
  () => Promise<{ default: LegalDoc }>
>;

async function loadLegalDoc(docName: LegalDocName, locale: string): Promise<LegalDoc> {
  // English returns synchronously from the eager-loaded fallback map.
  if (locale === 'en') return EN_FALLBACKS[docName];

  const key = `../content/legal/${docName}.${locale}.json`;
  const loader = legalLoaders[key];
  if (!loader) {
    // Translation output missing for this locale — fall back to English
    // with the existing disclaimer banner handling the language mismatch.
    return EN_FALLBACKS[docName];
  }
  try {
    const mod = await loader();
    return mod.default;
  } catch {
    return EN_FALLBACKS[docName];
  }
}

/** Parse the tiny inline subset (**bold**, [text](url), `code`) and return
 *  a React fragment. Translators reliably preserve this syntax per
 *  pre-run Gemma 4 validation (ES / JA / AR spot-checked). */
function renderInline(text: string): ReactNode {
  // Pattern matches any of the three inline forms.
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`)/g;
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="rounded bg-(--surface) px-1 py-0.5 text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const isExternal = !href.startsWith('mailto:') && !href.startsWith('/');
      return (
        <a
          key={i}
          href={href}
          className="text-(--accent) hover:text-(--accent-hover)"
          {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {label}
        </a>
      );
    }
    return part;
  });
}

function renderBlock(block: Block, index: number): ReactNode {
  switch (block.type) {
    case 'p':
      return (
        <p key={index} className="mt-2 first:mt-0">
          {renderInline(block.text)}
        </p>
      );
    case 'h3':
      return (
        <h3 key={index} className="mt-3 mb-1 text-sm font-semibold text-(--text-primary)">
          {renderInline(block.text)}
        </h3>
      );
    case 'ul':
      return (
        <ul key={index} className="mt-2 list-disc space-y-1 ps-5">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case 'callout':
      return (
        <div
          key={index}
          className="mt-2 rounded-lg border border-(--accent)/30 bg-(--accent)/5 p-4"
        >
          {block.blocks.map((b, i) => renderBlock(b, i))}
        </div>
      );
    case 'table':
      return (
        <div key={index} className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-(--border) text-start">
                {block.columns.map((col, i) => (
                  <th
                    key={i}
                    className={`py-2 font-medium text-(--text-primary) ${
                      i < block.columns.length - 1 ? 'pe-4' : ''
                    }`}
                  >
                    {renderInline(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-(--border)">
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`py-2 ${ci < row.length - 1 ? 'pe-4' : ''} ${
                        ci === 0 ? 'font-medium' : ''
                      }`}
                    >
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

interface LegalDocumentProps {
  /** Discriminates which doc source to load. */
  docName: LegalDocName;
  /** SEO-only; body rendering does not read this. */
  metaDescription: string;
}

export function LegalDocument({ docName, metaDescription }: LegalDocumentProps) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  // Seed with English so first paint has content (matters for the prerender
  // snapshot and for the zero-JS-hydration edge case). The async load below
  // overwrites this with the target locale's doc.
  const [doc, setDoc] = useState<LegalDoc>(EN_FALLBACKS[docName]);
  const [ready, setReady] = useState<string>(`${docName}-en`);

  useEffect(() => {
    let cancelled = false;
    loadLegalDoc(docName, locale).then((loaded) => {
      if (cancelled) return;
      setDoc(loaded);
      const sig = `${docName}-${locale}`;
      setReady(sig);
      if (typeof window !== 'undefined') {
        (window as unknown as { __legalDocReady?: string }).__legalDocReady = sig;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [docName, locale]);

  // Three display states for the legal-disclaimer banner:
  //   1. English locale: no banner (body is legally authoritative by default)
  //   2. Non-English + loaded translation: show the machine-translation
  //      disclaimer so the user understands the body is machine-generated
  //      and that the English version governs any legal dispute
  //   3. Non-English + English-body fallback (locale JSON missing or load
  //      failed): show the "only available in English" banner
  // The two non-English cases are mutually exclusive.
  const isEnglishBody = doc === EN_FALLBACKS[docName];
  const showMachineTranslationBanner = locale !== 'en' && !isEnglishBody;
  const showEnglishOnlyBanner = locale !== 'en' && isEnglishBody;

  // Meta title for this doc localises automatically via the rendered `doc`.
  const metaTitle = useMemo(() => `${doc.title} — Multiverse Echoes`, [doc.title]);

  return (
    <article
      data-legal-loaded={ready}
      className="flex min-h-screen flex-col bg-canvas"
    >
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
      </Helmet>
      <div className="mx-auto w-full max-w-3xl px-6 pt-28 pb-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-1 text-sm text-(--text-secondary) hover:text-(--text-primary)"
        >
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>

        {showMachineTranslationBanner && (
          <div
            className="mb-6 rounded-lg border border-(--accent)/30 bg-(--accent)/10 px-4 py-3 text-sm text-(--text-secondary)"
            role="note"
          >
            {t('common.legalMachineTranslationDisclaimer')}
          </div>
        )}

        {showEnglishOnlyBanner && (
          <div
            className="mb-6 rounded-lg border border-(--accent)/30 bg-(--accent)/10 px-4 py-3 text-sm text-(--text-secondary)"
            role="note"
          >
            {t('common.legalDocsEnglishOnly')}
          </div>
        )}

        <h1 className="mb-2 text-3xl font-bold text-(--text-primary)">
          {doc.title}
        </h1>
        <p className="mb-8 text-sm text-(--text-muted)">
          Last updated: {doc.lastUpdated}
        </p>

        <div className="flex flex-col gap-6 text-sm leading-relaxed text-(--text-secondary)">
          {doc.sections.map((section, i) => (
            <section key={i}>
              <h2 className="mb-2 text-lg font-semibold text-(--text-primary)">
                {section.heading}
              </h2>
              {section.blocks.map((b, bi) => renderBlock(b, bi))}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
