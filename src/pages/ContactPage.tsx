/**
 * ContactPage — public contact form.
 *
 * Backend is the me-contact Cloudflare Worker at api.echolabs.me/contact
 * (NOT the Rust backend), so the form keeps working when the B200 is down.
 * Worker handles Turnstile verification, rate limiting (3/IP/hr), D1
 * persistence, and Resend email forwarding. The destination address is a
 * Worker env secret — do not reference or request it from this file.
 *
 * Rendered inside <WebsiteLayout> so nav + footer come for free.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useTranslation } from 'react-i18next';
import { Input } from '../components/index.ts';

const CONTACT_API = 'https://api.echolabs.me/contact';
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  | string
  | undefined;

const SUBJECT_KEYS = [
  { value: 'General Inquiry', key: 'contact.subjectGeneral' },
  { value: 'Bug Report', key: 'contact.subjectBug' },
  { value: 'Press/Media', key: 'contact.subjectPress' },
  { value: 'Partnership', key: 'contact.subjectPartnership' },
  { value: 'Other', key: 'contact.subjectOther' },
] as const;

const MESSAGE_MAX = 2000;
const RESUBMIT_COOLDOWN_SECONDS = 60;

interface WorkerError {
  error?: string;
  field?: string;
}

export function ContactPage() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState<string>(SUBJECT_KEYS[0].value);
  const [message, setMessage] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // Cooldown tick — decrement each second after successful submit,
  // re-enables the form when it hits 0.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  function validate(): string | null {
    if (name.trim().length < 1) return t('contact.errorNameRequired');
    if (name.trim().length > 100) return t('contact.errorNameTooLong');
    const e = email.trim();
    if (e.length < 5 || !e.includes('@') || !e.includes('.')) {
      return t('contact.errorInvalidEmail');
    }
    if (!SUBJECT_KEYS.some((s) => s.value === subject)) {
      return t('contact.errorSelectSubject');
    }
    const m = message.trim();
    if (m.length < 1) return t('contact.errorMessageRequired');
    if (m.length > MESSAGE_MAX) {
      return t('contact.errorMessageTooLong', { max: MESSAGE_MAX });
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      return t('contact.errorCaptcha');
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (submitted || cooldown > 0) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(CONTACT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject,
          message: message.trim(),
          cf_turnstile_response: turnstileToken,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        setCooldown(RESUBMIT_COOLDOWN_SECONDS);
        return;
      }

      let body: WorkerError = {};
      try {
        body = (await res.json()) as WorkerError;
      } catch {
        // ignore — fall through with status-based message
      }

      if (res.status === 429) {
        setError(body.error ?? t('contact.errorRateLimit'));
      } else if (res.status === 400) {
        setError(body.error ?? t('contact.errorBadRequest'));
      } else {
        setError(body.error ?? t('contact.errorGeneric'));
      }
      turnstileRef.current?.reset();
      setTurnstileToken('');
    } catch {
      setError(t('contact.errorNetwork'));
      turnstileRef.current?.reset();
      setTurnstileToken('');
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit = !isSubmitting && !submitted && cooldown === 0;
  const messageRemaining = MESSAGE_MAX - message.trim().length;

  return (
    <>
      <Helmet>
        <title>{t('contact.metaTitle')}</title>
        <meta name="description" content={t('contact.metaDesc')} />
        <meta property="og:title" content={t('contact.metaTitle')} />
        <meta property="og:description" content={t('contact.metaDesc')} />
        <meta property="og:image" content="https://echolabsme.com/og-image-v2.png" />
        {/* og:url is emitted path-aware by WebsiteLayout. */}
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <div className="px-4 pt-28 pb-16 sm:px-6">
        <article className="mx-auto max-w-2xl">
          <h1 className="mb-4 font-serif text-4xl font-light tracking-wider text-(--text-primary)">
            {t('contact.title')}
          </h1>
          <p className="mb-10 leading-relaxed text-(--text-secondary)">
            {t('contact.description')}
          </p>

          {submitted ? (
            <div
              className="mb-10 rounded-xl border border-(--accent)/30 bg-(--accent)/5 p-6 text-center"
              role="status"
            >
              <h2 className="mb-2 text-xl font-medium text-(--text-primary)">
                {t('contact.successTitle')}
              </h2>
              <p className="leading-relaxed text-(--text-secondary)">
                {t('contact.successDesc')}
                {cooldown > 0 && (
                  <>
                    {' '}
                    <span className="text-(--text-muted)">
                      {t('contact.cooldown', { seconds: cooldown })}
                    </span>
                  </>
                )}
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="mb-10 flex flex-col gap-5"
              noValidate
            >
              <Input
                label={t('contact.labelName')}
                type="text"
                value={name}
                onChange={(e) =>
                  setName((e.target as HTMLInputElement).value)
                }
                required
                maxLength={100}
                autoComplete="name"
                disabled={!canSubmit}
              />

              <Input
                label={t('contact.labelEmail')}
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail((e.target as HTMLInputElement).value)
                }
                required
                maxLength={254}
                autoComplete="email"
                disabled={!canSubmit}
              />

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="contact-subject"
                  className="text-sm font-medium text-(--text-primary)"
                >
                  {t('contact.labelSubject')}
                </label>
                <select
                  id="contact-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  disabled={!canSubmit}
                  className="rounded-md border border-(--border) bg-(--surface) px-3 py-2 text-(--text-primary) transition-colors focus:border-(--accent) focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {SUBJECT_KEYS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {t(s.key)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <Input
                  label={t('contact.labelMessage')}
                  multiline
                  value={message}
                  onChange={(e) =>
                    setMessage((e.target as HTMLTextAreaElement).value)
                  }
                  required
                  maxLength={MESSAGE_MAX}
                  rows={7}
                  disabled={!canSubmit}
                />
                <p
                  className={`text-end text-xs ${
                    messageRemaining < 100
                      ? 'text-(--accent)'
                      : 'text-(--text-muted)'
                  }`}
                  aria-live="polite"
                >
                  {t('contact.charsRemaining', { count: messageRemaining })}
                </p>
              </div>

              {TURNSTILE_SITE_KEY && (
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={setTurnstileToken}
                  onExpire={() => setTurnstileToken('')}
                  onError={() => setTurnstileToken('')}
                  options={{ size: 'flexible', theme: 'dark' }}
                />
              )}

              {error && (
                <p
                  className="text-sm text-[var(--danger,#dc2626)]"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-md bg-(--accent) px-6 py-3 text-sm font-semibold text-(--canvas) transition-all hover:bg-(--accent-hover) hover:shadow-[0_0_30px_rgba(212,145,92,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? t('contact.sending') : t('contact.sendMessage')}
              </button>
            </form>
          )}

          <div className="text-center text-sm text-(--text-muted)">
            {t('contact.lookingElse')}{' '}
            <Link to="/about" className="text-(--accent) hover:underline">
              {t('website.nav.about')}
            </Link>
            {' · '}
            <Link
              to="/waitlist"
              className="text-(--accent) hover:underline"
            >
              {t('auth.joinWaitlist')}
            </Link>
          </div>
        </article>
      </div>
    </>
  );
}

export default ContactPage;
