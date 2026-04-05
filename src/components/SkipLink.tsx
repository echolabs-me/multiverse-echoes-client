import { useTranslation } from 'react-i18next';

interface SkipLinkProps {
  targetId?: string;
}

export function SkipLink({ targetId = 'main-content' }: SkipLinkProps) {
  const { t } = useTranslation();

  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-canvas"
    >
      {t('common.skipToContent', 'Skip to main content')}
    </a>
  );
}
