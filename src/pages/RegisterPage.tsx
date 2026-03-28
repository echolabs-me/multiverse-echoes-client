import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { Button, Input } from '../components/index.ts';
import { ApiRequestError, setTokens } from '../lib/api/client.ts';
import { auth } from '../lib/api/endpoints.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';
import { trackEvent } from '../lib/analytics.ts';

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (password.length < 12) errs.password = t('auth.passwordTooShort');
    if (password !== confirmPassword) errs.confirmPassword = t('auth.passwordMismatch');
    if (displayName.length < 3 || displayName.length > 30)
      errs.displayName = t('auth.displayNameInvalid');
    if (!tosAccepted) errs.tos = t('auth.tosRequired');
    if (!privacyAccepted) errs.privacy = t('auth.privacyRequired');
    return errs;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    try {
      const result = await auth.register({
        email,
        password,
        display_name: displayName,
        tos_accepted: tosAccepted,
        privacy_accepted: privacyAccepted,
        age_confirmed: true,
      });
      // Save tokens — server auto-logs-in on registration.
      setTokens(result.access_token, result.refresh_token);
      useAuthStore.setState({ isAuthenticated: true });
      trackEvent('account.registered', { method: 'email', locale: navigator.language });

      if (result.email_verified) {
        // Auto-verified (no email provider) — skip to onboarding.
        navigate('/onboarding/welcome');
      } else {
        navigate('/verify-pending', { state: { email } });
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.code === 'EMAIL_TAKEN') {
          setErrors({ email: t('auth.emailTaken') });
        } else if (err.code === 'DISPLAY_NAME_TAKEN') {
          setErrors({ displayName: t('auth.displayNameTaken') });
        } else {
          setErrors({ form: err.message });
        }
      } else {
        setErrors({ form: t('common.error') });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <Sparkles
            size={32}
            className="mb-3 text-accent"
            aria-hidden="true"
          />
          <h1 className="text-2xl font-bold text-text-primary">
            {t('auth.createAccount')}
          </h1>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <Input
            label={t('auth.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
            error={errors.email}
            required
            autoComplete="email"
          />

          <Input
            label={t('auth.displayName')}
            value={displayName}
            onChange={(e) => setDisplayName((e.target as HTMLInputElement).value)}
            error={errors.displayName}
            placeholder={t('auth.displayNameHint')}
            required
            autoComplete="username"
          />

          <div>
            <Input
              label={t('auth.password')}
              type="password"
              value={password}
              onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
              error={errors.password}
              required
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-text-muted">{t('auth.passwordHint')}</p>
          </div>

          <Input
            label={t('auth.confirmPassword')}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
            error={errors.confirmPassword}
            required
            autoComplete="new-password"
          />

          {/* Separate checkboxes per spec — not bundled */}
          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                className="mt-0.5 accent-accent"
              />
              <span>
                {t('auth.tosAgree')}{' '}
                <a
                  href="/terms-of-service"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent-hover underline"
                >
                  {t('auth.tosLink')}
                </a>
              </span>
            </label>
            {errors.tos && (
              <p className="text-xs text-danger" role="alert">
                {errors.tos}
              </p>
            )}

            <label className="flex items-start gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="mt-0.5 accent-accent"
              />
              <span>
                {t('auth.privacyAgree')}{' '}
                <a
                  href="/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent-hover underline"
                >
                  {t('auth.privacyLink')}
                </a>
              </span>
            </label>
            {errors.privacy && (
              <p className="text-xs text-danger" role="alert">
                {errors.privacy}
              </p>
            )}
          </div>

          {errors.form && (
            <p className="text-sm text-danger" role="alert">
              {errors.form}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('common.loading') : t('auth.createAccount')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          {t('auth.alreadyHaveAccount')}{' '}
          <Link to="/login" className="text-accent hover:text-accent-hover">
            {t('auth.logIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
