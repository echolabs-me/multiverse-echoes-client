import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';

export function App() {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas text-text-primary">
      <Sparkles
        className="mb-6 text-accent"
        size={48}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <h1 className="mb-2 text-4xl font-bold">{t('placeholder.hello')}</h1>
      <p className="text-lg text-text-secondary">
        {t('placeholder.description')}
      </p>
    </main>
  );
}
