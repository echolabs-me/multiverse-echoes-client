/**
 * WaitlistPage — Public landing page for pre-launch signups.
 *
 * No auth required. Hero + How It Works + Social Proof + Signup Form + Footer.
 * UTM tracking from URL query params.
 *
 * Reference: ME-UXF-001 §4.1, ME-LGM-001 §3.1.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Eye, Sparkles, Share2, CheckCircle } from 'lucide-react';
import { Button, Input, Card } from '../components/index.ts';
import { waitlist } from '../lib/api/endpoints.ts';

export function WaitlistPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  // Form state
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Post-signup state
  const [signupResult, setSignupResult] = useState<{
    position: number;
    referralCode: string;
    entryId: string;
  } | null>(null);

  // Social proof: total waitlist count
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Referral link copied feedback
  const [copied, setCopied] = useState(false);

  // UTM source from URL
  const source = searchParams.get('utm_source') ?? searchParams.get('source') ?? undefined;
  // Referral code from URL
  const refCode = searchParams.get('ref') ?? undefined;

  useEffect(() => {
    void waitlist.count().then((r) => setTotalCount(r.count)).catch(() => {});
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
      const result = await waitlist.signup({
        email: trimmed,
        referral_code: refCode,
        source,
      });
      setSignupResult({
        position: result.position,
        referralCode: result.referral_code,
        entryId: result.entry_id,
      });
      // Refresh count
      void waitlist.count().then((r) => setTotalCount(r.count)).catch(() => {});
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t('waitlist.signupError');
      if (message.includes('ALREADY_REGISTERED')) {
        setError(t('waitlist.alreadyRegistered'));
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCopyReferral() {
    if (!signupResult) return;
    const link = `https://echolabs.me/waitlist?ref=${signupResult.referralCode}`;
    void navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      {/* Hero Section */}
      <section className="flex flex-col items-center px-6 pb-16 pt-20 text-center">
        <h1 className="mb-4 max-w-2xl text-4xl font-bold leading-tight md:text-5xl">
          {t('waitlist.heroTitle')}
        </h1>
        <p className="mb-8 max-w-lg text-lg text-text-secondary">
          {t('waitlist.heroSubtitle')}
        </p>

        {/* Animated diary entry preview */}
        <div className="mb-12 w-full max-w-md" aria-hidden="true">
          <Card>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span className="h-2 w-2 rounded-full bg-accent" />
                {t('waitlist.diaryPreviewLabel')}
              </div>
              <p className="text-sm italic text-text-secondary">
                {t('waitlist.diaryPreviewText')}
              </p>
            </div>
          </Card>
        </div>

        {/* Signup or confirmation */}
        {!signupResult ? (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="flex w-full max-w-md flex-col gap-3"
          >
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder={t('waitlist.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label={t('waitlist.emailPlaceholder')}
                className="flex-1"
              />
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('common.loading') : t('waitlist.joinButton')}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            {totalCount !== null && totalCount > 0 && (
              <p className="text-xs text-text-muted">
                {t('waitlist.socialProofCount', { count: totalCount })}
              </p>
            )}
          </form>
        ) : (
          <Card>
            <div className="flex flex-col items-center gap-4 px-4 py-2">
              <CheckCircle size={32} className="text-success" />
              <h2 className="text-xl font-bold">
                {t('waitlist.confirmationTitle', {
                  position: signupResult.position,
                })}
              </h2>
              <p className="text-sm text-text-secondary">
                {t('waitlist.confirmationDesc')}
              </p>
              <div className="flex w-full items-center gap-2">
                <code className="flex-1 truncate rounded bg-surface-raised px-3 py-2 text-xs text-text-secondary">
                  https://echolabs.me/waitlist?ref={signupResult.referralCode}
                </code>
                <Button variant="secondary" onClick={handleCopyReferral}>
                  {copied ? t('common.copied') : t('common.copy')}
                </Button>
              </div>
              <p className="text-xs text-text-muted">
                {t('waitlist.referralHint')}
              </p>
            </div>
          </Card>
        )}
      </section>

      {/* How It Works */}
      <section className="bg-surface px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-center text-2xl font-bold">
            {t('waitlist.howItWorksTitle')}
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                <Eye size={24} className="text-accent" />
              </div>
              <h3 className="mb-2 font-semibold">{t('waitlist.step1Title')}</h3>
              <p className="text-sm text-text-secondary">
                {t('waitlist.step1Desc')}
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                <Sparkles size={24} className="text-accent" />
              </div>
              <h3 className="mb-2 font-semibold">{t('waitlist.step2Title')}</h3>
              <p className="text-sm text-text-secondary">
                {t('waitlist.step2Desc')}
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                <Share2 size={24} className="text-accent" />
              </div>
              <h3 className="mb-2 font-semibold">{t('waitlist.step3Title')}</h3>
              <p className="text-sm text-text-secondary">
                {t('waitlist.step3Desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Indie Narrative */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-6 text-2xl font-bold">
            {t('waitlist.socialProofTitle')}
          </h2>
          <p className="mb-4 text-text-secondary">
            {t('waitlist.socialProofDesc')}
          </p>
          <p className="text-sm italic text-text-muted">
            {t('waitlist.socialProofQuote')}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface px-6 py-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-sm text-text-muted">
          <div className="flex gap-6">
            <a href="/privacy" className="hover:text-text-secondary">
              {t('waitlist.privacyPolicy')}
            </a>
            <a href="/terms" className="hover:text-text-secondary">
              {t('waitlist.termsOfService')}
            </a>
          </div>
          <p>© 2026 EchoLabs. {t('waitlist.footerTagline')}</p>
        </div>
      </footer>
    </div>
  );
}

export default WaitlistPage;
