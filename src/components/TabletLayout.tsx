/**
 * TabletLayout — touch-first layout for iPad-sized screens.
 *
 * Three zones (all persistent):
 *   Left (260px): Echo list only, scrolls independently
 *   Centre (flex-1): Page content via Outlet, scrolls independently
 *   Right (280px): Oracle + Community as tabs, always visible
 *
 * Detection via navigator.maxTouchPoints >= 2 (see lib/deviceDetect.ts).
 */

import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { EchoSidebar } from './EchoSidebar.tsx';
import { OracleSidebar } from './OracleSidebar.tsx';
import { CommunitySidebar } from './CommunitySidebar.tsx';
import { CommunityPulseCard } from './CommunityPulseCard.tsx';
import { DiscordIcon } from './icons/DiscordIcon.tsx';

interface TabletLayoutProps {
  showEchoPanes: boolean;
}

type RightTab = 'oracle' | 'community';

export function TabletLayout({ showEchoPanes }: TabletLayoutProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<RightTab>('oracle');

  const selectOracle = useCallback(() => setActiveTab('oracle'), []);
  const selectCommunity = useCallback(() => setActiveTab('community'), []);

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
      {/* ── LEFT: Echo list (260px fixed) ── */}
      <aside className="flex w-[260px] flex-shrink-0 flex-col border-r border-border/50 bg-canvas">
        <EchoSidebar forceVisible />
      </aside>

      {/* ── COMMUNITY PULSE (260px fixed) ── */}
      <aside className="flex w-[260px] flex-shrink-0 flex-col border-r border-border/50 bg-canvas">
        <div className="flex-shrink-0 border-b border-border/50 px-3 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {t('communityFeed.title')}
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
          <CommunityPulseCard />
        </div>
      </aside>

      {/* ── CENTRE: Main content ── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {/* ── RIGHT: Oracle + Community tabs (280px fixed) ── */}
      <aside className="flex w-[280px] flex-shrink-0 flex-col border-l border-border/50 bg-canvas">
        {/* Tab bar */}
        <div className="flex flex-shrink-0 border-b border-border/50" role="tablist">
          <div
            onClick={selectOracle}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectOracle(); } }}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === 'oracle'
                ? 'border-b-2 border-accent text-accent'
                : 'text-text-muted hover:text-text-secondary'
            }`}
            aria-selected={activeTab === 'oracle'}
            role="tab"
            tabIndex={0}
          >
            <Sparkles size={14} />
            {t('oracle.title')}
          </div>
          <div
            onClick={selectCommunity}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCommunity(); } }}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === 'community'
                ? 'border-b-2 border-accent text-accent'
                : 'text-text-muted hover:text-text-secondary'
            }`}
            aria-selected={activeTab === 'community'}
            role="tab"
            tabIndex={0}
          >
            <DiscordIcon size={14} />
            {t('communitySidebar.title')}
          </div>
        </div>

        {/* Tab content — one mounts at a time */}
        <div className="flex flex-1 min-h-0 flex-col">
          {activeTab === 'oracle' ? <OracleSidebar /> : <CommunitySidebar />}
        </div>
      </aside>
    </div>
  );
}
