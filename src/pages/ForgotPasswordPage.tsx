import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { Button, Input } from '../components/index.ts';
import { request } from '../lib/api/client.ts';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) {
      setError(t('common.fieldRequired'));
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      await request('/auth/password-reset', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch {
      setError(t('auth.forgotPasswordError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <Sparkles size={32} className="mb-3 text-accent" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-text-primary">
            {t('auth.forgotPasswordTitle')}
          </h1>
        </div>

        {submitted ? (
          <div className="rounded-lg bg-surface p-6 text-center">
            <p className="text-text-primary">{t('auth.forgotPasswordSent')}</p>
            <Link to="/login" className="mt-4 inline-block text-sm text-accent hover:text-accent-hover">
              {t('auth.backToLogin')}
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-6 text-center text-sm text-text-secondary">
              {t('auth.forgotPasswordDesc')}
            </p>

            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="flex flex-col gap-4"
              noValidate
            >
              <Input
                label={t('auth.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
                required
                autoComplete="email"
              />

              {error && (
                <p className="text-sm text-danger" role="alert">{error}</p>
              )}

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('common.loading') : t('auth.sendResetLink')}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-text-secondary">
              <Link to="/login" className="text-accent hover:text-accent-hover">
                {t('auth.backToLogin')}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
