import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react';
import { Button } from '../components/index.ts';

const COOLDOWN_SECONDS = 60;

export function VerifyPendingPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? '';

  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleResend = useCallback(() => {
    // API call would go here — rate limited to 3/hr
    setCooldown(COOLDOWN_SECONDS);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center">
      <Mail size={48} className="mbe-6 text-accent" aria-hidden="true" />
      <h1 className="mbe-2 text-2xl font-bold text-text-primary">
        {t('auth.verifyTitle')}
      </h1>
      <p className="mbe-8 max-w-sm text-text-secondary">
        {t('auth.verifyDescription', { email })}
      </p>
      <Button
        variant="secondary"
        onClick={handleResend}
        disabled={cooldown > 0}
      >
        {cooldown > 0
          ? t('auth.resendCooldown', { seconds: cooldown })
          : t('auth.resend')}
      </Button>
    </div>
  );
}
