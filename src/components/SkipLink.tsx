import { useTranslation } from 'react-i18next';

interface SkipLinkProps {
  targetId?: string;
}

export function SkipLink({ targetId = 'main-content' }: SkipLinkProps) {
  const { t } = useTranslation();

  return (
    <a
      href={`#${targetId}`}
      className="fixed left-2 top-2 z-50 -translate-y-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-canvas transition-transform focus:translate-y-0"
    >
      {t('common.skipToContent', 'Skip to main content')}
    </a>
  );
}
