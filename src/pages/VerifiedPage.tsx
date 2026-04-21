import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle } from 'lucide-react';
import { Button } from '../components/index.ts';

export function VerifiedPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center">
      <CheckCircle
        size={48}
        className="mbe-6 text-success"
        aria-hidden="true"
      />
      <h1 className="mbe-2 text-2xl font-bold text-text-primary">
        {t('auth.verifiedTitle')}
      </h1>
      <p className="mbe-8 text-text-secondary">
        {t('auth.verifiedDescription')}
      </p>
      <Link to="/onboarding/welcome">
        <Button>{t('common.continue')}</Button>
      </Link>
    </div>
  );
}
