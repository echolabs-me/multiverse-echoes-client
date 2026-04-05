/**
 * TabletLayout — split-view master-detail for iPad-sized screens (md to xl).
 *
 * Landscape (>=1024px, <1280px):
 *   Persistent echo list sidebar (240px, collapsible) + main content + Oracle overlay
 *
 * Portrait (768px–1023px):
 *   Full-width main content + echo list overlay (from left) + Oracle overlay (from right)
 *   Active echo strip at top when echo list is hidden
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Outlet, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PanelLeftClose, PanelLeftOpen, Sparkles, MessageCircle, X, ChevronDown, ChevronRight } from 'lucide-react';
import { EchoSidebar } from './EchoSidebar.tsx';
import { OracleSidebar } from './OracleSidebar.tsx';
import { EchoConversationPanel } from './EchoConversationPanel.tsx';
import { CommunityPulseCard } from './CommunityPulseCard.tsx';
import { useEchoStore } from '../stores/useEchoStore.ts';
import { useShardStore } from '../stores/useShardStore.ts';
import { useFeedStore } from '../stores/useFeedStore.ts';
import { useOracleStore } from '../stores/useOracleStore.ts';
import { getMoodColor } from '../lib/moodColor.ts';
import { LayoutContext } from '../contexts/LayoutContext.tsx';
import type { LayoutContextValue, ConversationRequest } from '../contexts/LayoutContext.tsx';

const PULSE_STORAGE_KEY = 'tablet-pulse-open';

const SIDEBAR_STORAGE_KEY = 'tablet-echo-sidebar-open';

interface TabletLayoutProps {
  showEchoPanes: boolean;
}

export function TabletLayout({ showEchoPanes }: TabletLayoutProps) {
  const { t } = useTranslation();
  const location = useLocation();

  // Landscape vs portrait
  const [isLandscape, setIsLandscape] = useState(() => window.innerWidth >= 1024);

  useEffect(() => {
    const onResize = () => setIsLandscape(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Echo sidebar state
  const [echoSidebarOpen, setEchoSidebarOpen] = useState(() => {
    if (window.innerWidth >= 1024) {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      return stored === null ? true : stored === 'true';
    }
    return false;
  });

  // Oracle overlay state
  const [oracleOpen, setOracleOpen] = useState(false);

  // Conversation overlay state
  const [conversationReq, setConversationReq] = useState<ConversationRequest | null>(null);
  const conversationOpen = conversationReq !== null;

  // Persist landscape sidebar state
  useEffect(() => {
    if (isLandscape) {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(echoSidebarOpen));
    }
  }, [echoSidebarOpen, isLandscape]);

  // Close portrait overlays on orientation change to landscape
  useEffect(() => {
    if (isLandscape) {
      // Restore persisted sidebar state for landscape
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      setEchoSidebarOpen(stored === null ? true : stored === 'true');
    } else {
      // Portrait: close sidebar by default
      setEchoSidebarOpen(false);
    }
  }, [isLandscape]);

  // Close overlays on route change (portrait)
  useEffect(() => {
    if (!isLandscape) {
      setEchoSidebarOpen(false);
    }
    setOracleOpen(false);
    setConversationReq(null);
  }, [location.pathname, isLandscape]);

  const toggleEchoSidebar = useCallback(() => {
    setEchoSidebarOpen((prev) => {
      if (!prev) setOracleOpen(false); // close Oracle when opening echo list
      return !prev;
    });
  }, []);

  const toggleOracle = useCallback(() => {
    setOracleOpen((prev) => {
      if (!prev) {
        if (!isLandscape) setEchoSidebarOpen(false);
        setConversationReq(null); // close conversation when opening Oracle
      }
      return !prev;
    });
  }, [isLandscape]);

  const openConversation = useCallback((req: ConversationRequest) => {
    setConversationReq(req);
    setOracleOpen(false); // close Oracle when opening conversation
    if (!isLandscape) setEchoSidebarOpen(false);
  }, [isLandscape]);

  const closeConversation = useCallback(() => {
    setConversationReq(null);
  }, []);

  const layoutCtx = useMemo<LayoutContextValue>(() => ({
    mode: 'tablet',
    openConversation,
    closeConversation,
  }), [openConversation, closeConversation]);

  // Non-echo pages (settings, search, etc.) — just render Outlet full width
  if (!showEchoPanes) {
    return (
      <LayoutContext.Provider value={layoutCtx}>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </LayoutContext.Provider>
    );
  }

  return (
    <LayoutContext.Provider value={layoutCtx}>
      <div className="relative flex h-full w-full overflow-hidden">
        {/* ── LANDSCAPE: Persistent echo sidebar ── */}
        {isLandscape && echoSidebarOpen && (
          <aside className="flex h-full w-[260px] flex-shrink-0 flex-col border-r border-border/50 bg-canvas">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t('echoSidebar.title')}
              </span>
              <button
                onClick={toggleEchoSidebar}
                className="rounded-md p-2.5 text-text-muted hover:bg-surface-raised hover:text-text-secondary transition-colors"
                aria-label={t('common.collapseSidebar')}
                title={t('common.collapseSidebar')}
              >
                <PanelLeftClose size={14} />
              </button>
            </div>
            <SidebarPulseSection />
            <EchoSidebar forceVisible />
          </aside>
        )}

        {/* ── LANDSCAPE: Expand sidebar button (when collapsed) ── */}
        {isLandscape && !echoSidebarOpen && (
          <button
            onClick={toggleEchoSidebar}
            className="flex h-full w-10 flex-shrink-0 items-start pt-3 justify-center border-r border-border/50 bg-canvas text-text-muted hover:bg-surface-raised hover:text-text-secondary transition-colors"
            aria-label={t('echoSidebar.title')}
            title={t('echoSidebar.title')}
          >
            <PanelLeftOpen size={14} />
          </button>
        )}

        {/* ── MAIN CONTENT ── */}
        <main className="flex h-full flex-1 flex-col overflow-hidden">
          {/* Portrait: active echo strip */}
          {!isLandscape && <ActiveEchoStrip onTap={toggleEchoSidebar} />}

          <div className="flex-1 overflow-y-auto">
            <Outlet />
          </div>

          {/* FAB buttons — bottom-right of main content */}
          <div className="absolute bottom-4 right-4 z-30 flex flex-col gap-2">
            {/* Conversation FAB — only when a conversation was opened and then dismissed */}
            {conversationReq && !conversationOpen && (
              <button
                onClick={() => openConversation(conversationReq)}
                className="flex items-center justify-center rounded-full bg-accent p-3 text-canvas shadow-lg hover:bg-accent-hover transition-colors"
                aria-label={t('echoDetail.talkToEcho')}
                title={t('echoDetail.talkToEcho')}
              >
                <MessageCircle size={18} />
              </button>
            )}
            {/* Oracle FAB */}
            <button
              onClick={toggleOracle}
              className="flex items-center justify-center rounded-full bg-accent p-3 text-canvas shadow-lg hover:bg-accent-hover transition-colors"
              aria-label={t('oracle.title')}
              title={t('oracle.title')}
            >
              <Sparkles size={18} />
              {useOracleStore.getState().messages.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-canvas bg-danger" />
              )}
            </button>
          </div>
        </main>

        {/* ── PORTRAIT: Echo list overlay (from left) ── */}
        {!isLandscape && echoSidebarOpen && (
          <>
            <button
              className="fixed inset-0 z-38 bg-black/30 cursor-default"
              style={{ left: '76px' }}
              onClick={() => setEchoSidebarOpen(false)}
              aria-label={t('common.close')}
              tabIndex={-1}
            />
            <aside
              className="fixed top-0 bottom-0 z-40 flex w-[260px] flex-col bg-canvas border-r border-border/50 animate-slide-in-left"
              style={{ left: '76px' }}
            >
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {t('echoSidebar.title')}
                </span>
                <button
                  onClick={() => setEchoSidebarOpen(false)}
                  className="rounded-md p-2.5 text-text-muted hover:text-text-secondary"
                  aria-label={t('common.close')}
                >
                  <X size={14} />
                </button>
              </div>
              <SidebarPulseSection />
              <EchoSidebar forceVisible />
            </aside>
          </>
        )}

        {/* ── CONVERSATION OVERLAY (both orientations) ── */}
        {conversationOpen && conversationReq && (
          <>
            <button
              className="fixed inset-0 z-39 bg-black/30 cursor-default"
              style={{ left: '76px' }}
              onClick={closeConversation}
              aria-label={t('common.close')}
              tabIndex={-1}
            />
            <aside
              className="fixed top-0 bottom-0 right-0 z-40 flex w-[400px] max-w-[calc(100vw-76px)] flex-col bg-canvas border-l border-border/50 animate-slide-in-right"
            >
              <EchoConversationPanel
                key={conversationReq.resumeConversationId ?? conversationReq.echoId}
                echoId={conversationReq.echoId}
                echoName={conversationReq.echoName}
                echoMood={conversationReq.echoMood}
                onClose={closeConversation}
                resumeConversationId={conversationReq.resumeConversationId}
              />
            </aside>
          </>
        )}

        {/* ── ORACLE OVERLAY (both orientations) ── */}
        {oracleOpen && (
          <>
            <button
              className="fixed inset-0 z-39 bg-black/30 cursor-default"
              style={{ right: '0', left: '76px' }}
              onClick={() => setOracleOpen(false)}
              aria-label={t('common.close')}
              tabIndex={-1}
            />
            <aside
              className="fixed top-0 bottom-0 right-0 z-40 flex w-[340px] flex-col bg-canvas border-l border-border/50 animate-slide-in-right"
            >
              <OracleSidebar />
            </aside>
          </>
        )}
      </div>
    </LayoutContext.Provider>
  );
}

/**
 * Collapsible Community Pulse section — sits above the echo list in the sidebar.
 * Fixed height (does not compress echo list). Activity indicator when collapsed.
 * Toggle state persisted in localStorage.
 */
function SidebarPulseSection() {
  const { t } = useTranslation();
  const feedCount = useFeedStore((s) => s.personalFeed.length);
  const [open, setOpen] = useState(() => {
    const stored = localStorage.getItem(PULSE_STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  });

  const toggle = useCallback(() => {
    setOpen((prev) => {
      localStorage.setItem(PULSE_STORAGE_KEY, String(!prev));
      return !prev;
    });
  }, []);

  return (
    <div className="flex-shrink-0 border-b-2 border-border bg-surface-raised/30">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-surface-raised transition-colors"
        style={{ minHeight: '44px' }}
      >
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-accent/70">
          {t('communityFeed.title')}
          {!open && feedCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent/20 px-1 text-[9px] font-bold text-accent">
              {feedCount > 9 ? '9+' : feedCount}
            </span>
          )}
        </span>
        {open
          ? <ChevronDown size={14} className="text-text-muted" />
          : <ChevronRight size={14} className="text-text-muted" />
        }
      </button>
      {open && (
        <div className="h-[180px] overflow-y-auto px-2 pb-2">
          <CommunityPulseCard />
        </div>
      )}
    </div>
  );
}

/**
 * Compact strip showing active echo info — portrait mode only.
 * Tapping opens the echo list overlay.
 */
function ActiveEchoStrip({ onTap }: { onTap: () => void }) {
  const { echoId } = useParams<{ echoId: string }>();
  const location = useLocation();
  const echoList = useEchoStore((s) => s.echoList);
  const shardList = useShardStore((s) => s.shardList);

  const activeEcho = echoId
    ? echoList.find((e) => e.echo_id === echoId)
    : location.pathname === '/dashboard'
      ? echoList[0]
      : undefined;

  if (!activeEcho) return null;

  const shardName = shardList.find((s) => s.shard_id === activeEcho.current_shard_id)?.name ?? '';
  const moodColor = getMoodColor(activeEcho.current_mood);

  return (
    <button
      onClick={onTap}
      className="flex h-12 w-full flex-shrink-0 items-center gap-3 border-b border-border/50 bg-surface/80 px-4 text-left transition-colors hover:bg-surface-raised"
    >
      <span
        className="h-3 w-3 flex-shrink-0 rounded-full"
        style={{ backgroundColor: moodColor }}
      />
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <span className="truncate text-sm font-medium text-text-primary">
          {activeEcho.name}
        </span>
        <span className="text-xs text-text-muted truncate">
          {activeEcho.current_mood}
        </span>
      </div>
      {shardName && (
        <span className="text-[11px] text-text-muted truncate max-w-[120px]">
          {shardName}
        </span>
      )}
      <PanelLeftOpen size={14} className="flex-shrink-0 text-text-muted" />
    </button>
  );
}
