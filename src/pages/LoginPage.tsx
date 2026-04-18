import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { Button, Input } from '../components/index.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';
import { trackEvent } from '../lib/analytics.ts';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<TurnstileInstance>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError(t('common.fieldRequired'));
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      await login({ email, password, cf_turnstile_response: turnstileToken });
      localStorage.setItem('has_logged_in', 'true');
      trackEvent('account.login', { method: 'password' });
      navigate('/dashboard');
    } catch {
      setError(t('auth.loginFailed'));
    } finally {
      setIsSubmitting(false);
      turnstileRef.current?.reset();
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
            {localStorage.getItem('has_logged_in')
              ? t('auth.loginTitleReturning')
              : t('auth.loginTitle')}
          </h1>
        </div>

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

          <Input
            label={t('auth.password')}
            type="password"
            value={password}
            onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
            required
            autoComplete="current-password"
          />

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          {TURNSTILE_SITE_KEY && (
            <Turnstile
              ref={turnstileRef}
              siteKey={TURNSTILE_SITE_KEY}
              onSuccess={setTurnstileToken}
              options={{ size: 'flexible', theme: 'dark' }}
            />
          )}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('common.loading') : t('auth.logIn')}
          </Button>

          <p className="text-end text-sm">
            <Link to="/forgot-password" className="text-accent hover:text-accent-hover">
              {t('auth.forgotPassword')}
            </Link>
          </p>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="text-accent hover:text-accent-hover">
            {t('auth.createOne')}
          </Link>
        </p>
      </div>
    </div>
  );
}
