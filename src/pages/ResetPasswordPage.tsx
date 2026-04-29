import { useState, type FormEvent } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { Button, Input } from '../components/index.ts';
import { request } from '../lib/api/client.ts';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t('auth.passwordsMismatch'));
      return;
    }
    if (password.length < 12) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      await request('/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ reset_token: token, new_password: password }),
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch {
      setError(t('auth.resetPasswordError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-md text-center">
          <p className="text-text-secondary">{t('auth.resetTokenMissing')}</p>
          <Link
            to="/forgot-password"
            className="mbs-4 inline-block text-accent hover:text-accent-hover"
          >
            {t('auth.requestNewReset')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md">
        <div className="mbe-8 flex flex-col items-center">
          <Sparkles
            size={32}
            className="mbe-3 text-accent"
            aria-hidden="true"
          />
          <h1 className="text-2xl font-bold text-text-primary">
            {t('auth.resetPasswordTitle')}
          </h1>
        </div>

        {success ? (
          <div className="rounded-lg bg-surface p-6 text-center">
            <p className="text-text-primary">
              {t('auth.resetPasswordSuccess')}
            </p>
            <p className="mbs-2 text-sm text-text-secondary">
              {t('auth.redirectingToLogin')}
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="flex flex-col gap-4"
            noValidate
          >
            <Input
              label={t('auth.newPassword')}
              type="password"
              value={password}
              onChange={(e) =>
                setPassword((e.target as HTMLInputElement).value)
              }
              required
              autoComplete="new-password"
            />

            <Input
              label={t('auth.confirmPassword')}
              type="password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword((e.target as HTMLInputElement).value)
              }
              required
              autoComplete="new-password"
            />

            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('auth.resetPassword')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
