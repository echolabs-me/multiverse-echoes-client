import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Full error + component stack to DevTools — the UI never surfaces these
    // because thrown errors can leak paths, tokens, or API fragments.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}

export function ErrorFallback() {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex min-h-screen items-center justify-center bg-canvas px-4"
    >
      <div className="flex max-w-md flex-col items-center text-center">
        <h1 className="mbe-3 text-2xl font-bold text-text-primary">
          {t('errors.appCrashed.title')}
        </h1>
        <p className="mbe-6 text-sm text-text-secondary">
          {t('errors.appCrashed.body')}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-accent-fg rounded-md bg-accent px-4 py-2 text-sm font-medium hover:bg-accent/90"
        >
          {t('errors.appCrashed.reload')}
        </button>
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
