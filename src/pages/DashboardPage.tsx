import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState, Button, Spinner } from '../components/index.ts';
import { useEchoStore } from '../stores/useEchoStore.ts';

/**
 * Dashboard — entry point that redirects to the first Echo's detail page.
 * The EchoSidebar (in AppLayout) serves as the overview panel.
 * This page only handles the empty state (no Echoes) and the initial redirect.
 */
export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { echoList, fetchEchoes } = useEchoStore();

  const [initialLoadDone, setInitialLoadDone] = useState(false);

  useEffect(() => {
    void fetchEchoes().finally(() => setInitialLoadDone(true));
  }, [fetchEchoes]);

  // Auto-navigate to the first echo's detail page.
  useEffect(() => {
    if (initialLoadDone && echoList.length > 0) {
      navigate(`/echoes/${echoList[0]!.echo_id}`, { replace: true });
    }
  }, [initialLoadDone, echoList, navigate]);

  if (!initialLoadDone) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // No echoes — show empty state with create prompt.
  if (echoList.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          title={t('dashboard.noEchoes')}
          description={t('dashboard.noEchoesDesc')}
          action={
            <Button onClick={() => navigate('/onboarding/create-echo')}>
              {t('dashboard.createNewEcho')}
            </Button>
          }
        />
      </div>
    );
  }

  // Echoes exist but haven't navigated yet — brief loading.
  return (
    <div className="flex flex-1 items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
