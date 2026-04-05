/**
 * TabletLayout — touch-first layout for iPad-sized screens (md to 1440px).
 *
 * Three zones:
 *   Left sidebar (260px): Echo list only, scrolls independently, Create Echo pinned to bottom
 *   Main content (flex-1): Page content via Outlet, scrolls independently
 *   Right overlay: Oracle, slides in from right, dismissed by backdrop tap or X
 *
 * Community Pulse is accessed via the Community nav icon (navigates to CommunityPage).
 * It does not live in the sidebar.
 */

import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { EchoSidebar } from './EchoSidebar.tsx';
import { OracleSidebar } from './OracleSidebar.tsx';
import { useOracleStore } from '../stores/useOracleStore.ts';

interface TabletLayoutProps {
  showEchoPanes: boolean;
}

export function TabletLayout({ showEchoPanes }: TabletLayoutProps) {
  const { t } = useTranslation();
  const oracleMessageCount = useOracleStore((s) => s.messages.length);

  // Oracle overlay state — dismissed via backdrop tap or X button
  const [oracleOpen, setOracleOpen] = useState(false);

  const toggleOracle = useCallback(() => {
    setOracleOpen((prev) => !prev);
  }, []);

  // Non-echo pages (settings, search, etc.) — render Outlet full width
  if (!showEchoPanes) {
    return (
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    );
  }

  return (
    <div className="relative flex flex-1 w-full overflow-hidden">
      {/* ── LEFT SIDEBAR: Echo list only (260px fixed) ── */}
      <aside className="flex w-[260px] flex-shrink-0 flex-col border-r border-border/50 bg-canvas">
        <EchoSidebar forceVisible />
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {/* Oracle FAB — outside main so overflow-hidden doesn't clip it */}
      <button
        onClick={toggleOracle}
        className="fixed bottom-4 right-4 z-30 flex items-center justify-center rounded-full bg-accent p-3 text-canvas shadow-lg hover:bg-accent-hover transition-colors"
        aria-label={t('oracle.title')}
        title={t('oracle.title')}
      >
        <Sparkles size={18} />
        {oracleMessageCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-canvas bg-danger" />
        )}
      </button>

      {/* ── ORACLE OVERLAY — slides in from right, below app header ── */}
      {oracleOpen && (
        <>
          <button
            className="fixed inset-0 z-40 bg-black/30 cursor-default"
            style={{ left: '76px' }}
            onClick={() => setOracleOpen(false)}
            aria-label={t('common.close')}
            tabIndex={-1}
          />
          <aside className="fixed top-[56px] bottom-0 right-0 z-50 flex w-[340px] flex-col bg-canvas border-l border-border/50 animate-slide-in-right">
            <OracleSidebar />
          </aside>
        </>
      )}
    </div>
  );
}
