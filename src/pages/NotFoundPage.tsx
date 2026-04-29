import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { Button } from '../components/index.ts';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="flex flex-col items-center text-center">
        <Compass
          size={48}
          className="mbe-4 text-text-muted"
          aria-hidden="true"
        />
        <h1 className="mbe-2 text-2xl font-bold text-text-primary">
          {t('common.notFoundTitle')}
        </h1>
        <p className="mbe-6 text-sm text-text-secondary">
          {t('common.notFoundDesc')}
        </p>
        <Link to="/dashboard">
          <Button>{t('common.backToDashboard')}</Button>
        </Link>
        <a
          href="https://status.echolabsme.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mbs-6 text-xs text-text-muted underline underline-offset-4 hover:text-text-secondary"
        >
          {t('common.checkStatusLink')}
        </a>
      </div>
    </div>
  );
}
