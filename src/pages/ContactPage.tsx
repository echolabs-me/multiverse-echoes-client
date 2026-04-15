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
import { Input } from '../components/index.ts';

const CONTACT_API = 'https://api.echolabs.me/contact';
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  | string
  | undefined;

const SUBJECTS = [
  'General Inquiry',
  'Bug Report',
  'Press/Media',
  'Partnership',
  'Other',
] as const;

const MESSAGE_MAX = 2000;
const RESUBMIT_COOLDOWN_SECONDS = 60;

interface WorkerError {
  error?: string;
  field?: string;
}

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
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
    if (name.trim().length < 1) return 'Name is required.';
    if (name.trim().length > 100) return 'Name is too long (max 100 characters).';
    const e = email.trim();
    if (e.length < 5 || !e.includes('@') || !e.includes('.')) {
      return 'Please enter a valid email address.';
    }
    if (!SUBJECTS.includes(subject as (typeof SUBJECTS)[number])) {
      return 'Please select a subject.';
    }
    const m = message.trim();
    if (m.length < 1) return 'Message is required.';
    if (m.length > MESSAGE_MAX) {
      return `Message is too long (max ${MESSAGE_MAX} characters).`;
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      return 'Please complete the captcha.';
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
        setError(
          body.error ??
            'Too many submissions from your IP. Please try again in an hour.',
        );
      } else if (res.status === 400) {
        setError(body.error ?? 'Please check your submission and try again.');
      } else {
        setError(
          body.error ?? 'Something went wrong. Please try again in a moment.',
        );
      }
      turnstileRef.current?.reset();
      setTurnstileToken('');
    } catch {
      setError(
        "Couldn't reach the contact service. Please check your connection and try again.",
      );
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
        <title>Contact — Multiverse Echoes</title>
        <meta
          name="description"
          content="Get in touch with EchoLabsME. We typically reply within 48 hours."
        />
        <meta property="og:title" content="Contact — Multiverse Echoes" />
        <meta
          property="og:description"
          content="Get in touch with EchoLabsME. We typically reply within 48 hours."
        />
        <meta property="og:image" content="https://echolabsme.com/og-image-v2.png" />
        <meta property="og:url" content="https://echolabsme.com/contact" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <div className="px-4 pt-28 pb-16 sm:px-6">
        <article className="mx-auto max-w-2xl">
          <h1 className="mb-4 font-serif text-4xl font-light tracking-wider text-[var(--text-primary)]">
            Contact
          </h1>
          <p className="mb-10 leading-relaxed text-[var(--text-secondary)]">
            Questions, press enquiries, bug reports, or anything else — send
            them here and we&rsquo;ll get back to you within 48 hours.
          </p>

          {submitted ? (
            <div
              className="mb-10 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-6 text-center"
              role="status"
            >
              <h2 className="mb-2 text-xl font-medium text-[var(--text-primary)]">
                Thanks — your message is on its way
              </h2>
              <p className="leading-relaxed text-[var(--text-secondary)]">
                We&rsquo;ll get back to you within 48 hours.
                {cooldown > 0 && (
                  <>
                    {' '}
                    <span className="text-[var(--text-muted)]">
                      You can send another message in {cooldown}s.
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
                label="Name"
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
                label="Email"
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
                  className="text-sm font-medium text-[var(--text-primary)]"
                >
                  Subject
                </label>
                <select
                  id="contact-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  disabled={!canSubmit}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text-primary)] transition-colors focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <Input
                  label="Message"
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
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--text-muted)]'
                  }`}
                  aria-live="polite"
                >
                  {messageRemaining} characters remaining
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
                className="rounded-md bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--canvas)] transition-all hover:bg-[var(--accent-hover)] hover:shadow-[0_0_30px_rgba(212,145,92,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}

          <div className="text-center text-sm text-[var(--text-muted)]">
            Looking for something else?{' '}
            <Link to="/about" className="text-[var(--accent)] hover:underline">
              About
            </Link>
            {' · '}
            <Link
              to="/waitlist"
              className="text-[var(--accent)] hover:underline"
            >
              Join the waitlist
            </Link>
          </div>
        </article>
      </div>
    </>
  );
}

export default ContactPage;
