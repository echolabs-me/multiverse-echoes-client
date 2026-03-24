import { useTranslation } from 'react-i18next';
import { Moon, Sparkles, Sun } from 'lucide-react';
import { useThemeStore } from './stores/useThemeStore.ts';

export function App() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useThemeStore();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas text-text-primary">
      <Sparkles
        className="mb-6 text-accent"
        size={48}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <h1 className="mb-2 text-4xl font-bold">{t('placeholder.hello')}</h1>
      <p className="mb-8 text-lg text-text-secondary">
        {t('placeholder.description')}
      </p>
      <button
        onClick={toggleTheme}
        className="flex items-center gap-2 rounded-md bg-surface px-5 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
        aria-label={
          theme === 'dark'
            ? t('common.switchToLight', 'Switch to light mode')
            : t('common.switchToDark', 'Switch to dark mode')
        }
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        {theme === 'dark' ? 'Light' : 'Dark'}
      </button>
    </main>
  );
}
