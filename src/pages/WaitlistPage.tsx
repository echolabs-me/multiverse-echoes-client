/**
 * WaitlistPage — public landing page for pre-launch signups.
 *
 * Count + signup both hit the Cloudflare Worker at api.echolabs.me (backed
 * by the me-waitlist D1 database), NOT the Rust backend. The Rust backend
 * only has test entries. The Worker handles the real flow: D1 insert →
 * verification email via Resend → profile completion at /verify → status
 * "waiting".
 *
 * Rendered inside <WebsiteLayout> so nav + footer come for free.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Input } from '../components/index.ts';

const WAITLIST_API = 'https://api.echolabs.me';

interface CountResponse {
  total: number;
  unverified: number;
  waiting: number;
  invited: number;
}

interface WorkerErrorBody {
  error?: string;
}

async function fetchWaitlistCount(): Promise<CountResponse> {
  const res = await fetch(`${WAITLIST_API}/waitlist/count`, { method: 'GET' });
  if (!res.ok) throw new Error(`count failed: ${res.status}`);
  return (await res.json()) as CountResponse;
}

async function signupForWaitlist(email: string, source?: string): Promise<void> {
  const res = await fetch(`${WAITLIST_API}/waitlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, source: source ?? 'waitlist-page' }),
  });
  if (res.ok) return;
  let msg = `signup failed: ${res.status}`;
  try {
    const body = (await res.json()) as WorkerErrorBody;
    if (body.error) msg = body.error;
  } catch {
    // non-JSON body — fall through with the status-only message
  }
  if (res.status === 409) throw new Error('ALREADY_REGISTERED');
  throw new Error(msg);
}

export function WaitlistPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const source = searchParams.get('utm_source') ?? searchParams.get('source') ?? undefined;

  useEffect(() => {
    let cancelled = false;
    fetchWaitlistCount()
      .then((r) => {
        if (!cancelled) setTotalCount(r.total);
      })
      .catch(() => {
        // Count is social proof — silent on failure, page still works.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@') || trimmed.length < 5) {
      setError(t('waitlist.invalidEmail'));
      return;
    }

    setIsSubmitting(true);
    try {
      await signupForWaitlist(trimmed, source);
      setSubmittedEmail(trimmed);
      // Refresh count — don't block the success render on it.
      fetchWaitlistCount()
        .then((r) => setTotalCount(r.total))
        .catch(() => {});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('waitlist.signupError');
      if (message === 'ALREADY_REGISTERED') {
        setError(t('waitlist.alreadyRegistered'));
      } else {
        setError(t('waitlist.signupError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>{t('waitlist.metaTitle')}</title>
        <meta
          name="description"
          content={t('waitlist.metaDesc')}
        />
        <meta property="og:title" content={t('waitlist.ogTitle')} />
        <meta
          property="og:description"
          content={t('waitlist.ogDesc')}
        />
        <meta property="og:image" content="https://echolabsme.com/og-image-v2.png" />
        {/* og:url is emitted path-aware by WebsiteLayout. */}
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <div className="px-4 pbs-28 pbe-16 sm:px-6">
        <article className="mx-auto max-w-2xl">
          <h1 className="mbe-4 font-serif text-4xl font-light tracking-wider text-(--text-primary)">
            {t('auth.joinWaitlist')}
          </h1>

          <p className="mbe-10 leading-relaxed text-(--text-secondary)">
            {t('waitlist.heroSubtitle')}
          </p>

          {/* Count banner — big number, same treatment as About › The Numbers */}
          <div className="mbe-10 rounded-xl border border-(--border) bg-(--surface) p-6 text-center">
            <p className="text-4xl font-light text-(--accent)">
              {totalCount !== null ? totalCount.toLocaleString() : '—'}
            </p>
            <p className="mbs-1 text-sm text-(--text-muted)">{t('waitlist.alreadyWaiting')}</p>
          </div>

          {/* Signup or success */}
          {submittedEmail === null ? (
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="mbe-16 flex flex-col gap-3"
              noValidate
            >
              <label htmlFor="waitlist-email" className="sr-only">
                {t('waitlist.emailPlaceholder')}
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  id="waitlist-email"
                  type="email"
                  placeholder={t('waitlist.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label={t('waitlist.emailPlaceholder')}
                  className="flex-1"
                  autoComplete="email"
                  required
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-(--accent) px-6 py-3 text-sm font-semibold text-(--canvas) transition-all hover:bg-(--accent-hover) hover:shadow-[0_0_30px_rgba(212,145,92,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? t('common.loading') : t('waitlist.joinButton')}
                </button>
              </div>
              {error && (
                <p className="text-sm text-(--danger,#dc2626)" role="alert">
                  {error}
                </p>
              )}
            </form>
          ) : (
            <div
              className="mbe-16 rounded-xl border border-(--accent)/30 bg-(--accent)/5 p-6 text-center"
              role="status"
            >
              <h2 className="mbe-2 text-xl font-medium text-(--text-primary)">
                {t('waitlist.checkEmailTitle')}
              </h2>
              <p className="leading-relaxed text-(--text-secondary)">
                {t('waitlist.checkEmailDesc', { email: submittedEmail })}
              </p>
            </div>
          )}

          {/* What to expect — reuses existing expectStep1-3 i18n keys */}
          <section className="mbe-12">
            <h2 className="mbe-4 text-xl font-medium text-(--text-primary)">
              {t('waitlist.expectTitle')}
            </h2>
            <ol className="flex flex-col gap-4 text-(--text-secondary)">
              <li className="flex gap-4 leading-relaxed">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-(--accent)/15 text-sm font-medium text-(--accent)">
                  1
                </span>
                <span>{t('waitlist.expectStep1')}</span>
              </li>
              <li className="flex gap-4 leading-relaxed">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-(--accent)/15 text-sm font-medium text-(--accent)">
                  2
                </span>
                <span>{t('waitlist.expectStep2')}</span>
              </li>
              <li className="flex gap-4 leading-relaxed">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-(--accent)/15 text-sm font-medium text-(--accent)">
                  3
                </span>
                <span>{t('waitlist.expectStep3')}</span>
              </li>
            </ol>
          </section>

          <div className="mbs-16 text-center text-sm text-(--text-muted)">
            {t('waitlist.haveInviteCode')}{' '}
            <Link to="/register" className="text-(--accent) hover:underline">
              {t('waitlist.registerHere')}
            </Link>
            .
          </div>
        </article>
      </div>
    </>
  );
}

export default WaitlistPage;
