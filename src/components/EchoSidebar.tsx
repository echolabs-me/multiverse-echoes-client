import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, X } from 'lucide-react';
import { useEchoStore } from '../stores/useEchoStore.ts';
import { useShardStore } from '../stores/useShardStore.ts';
import { getMoodColor } from '../lib/moodColor.ts';
import type { EchoResponse } from '../types/api.ts';

/**
 * Compact Echo list item — Discord-style density.
 * Shows name, mood dot, shard name. Active item has accent highlight.
 */
function EchoListItem({
  echo,
  isActive,
  shardName,
  onClick,
}: {
  echo: EchoResponse;
  isActive: boolean;
  shardName: string;
  onClick: () => void;
}) {
  const moodColor = getMoodColor(echo.current_mood);

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors ${
        isActive
          ? 'bg-accent-subtle text-accent'
          : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
      }`}
      aria-current={isActive ? 'page' : undefined}
    >
      {/* Mood dot */}
      <span
        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: moodColor }}
        aria-label={echo.current_mood}
      />
      {/* Name + shard */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{echo.name}</p>
        <p className="truncate text-[11px] text-text-muted leading-tight">{shardName}</p>
      </div>
    </button>
  );
}

/**
 * Desktop Echo sidebar — persistent vertical list to the right of NavSidebar.
 * Visible on md+ screens when on dashboard or echo detail routes.
 */
export function EchoSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { echoId } = useParams<{ echoId: string }>();
  const { echoList, fetchEchoes } = useEchoStore();
  const { shardList, fetchShards } = useShardStore();

  useEffect(() => {
    if (echoList.length === 0) void fetchEchoes();
  }, [echoList.length, fetchEchoes]);

  useEffect(() => {
    if (shardList.length === 0) void fetchShards();
  }, [shardList.length, fetchShards]);

  const shardNameMap = new Map(shardList.map((s) => [s.shard_id, s.name]));

  const handleClick = (echo: EchoResponse) => {
    navigate(`/echoes/${echo.echo_id}`);
  };

  if (echoList.length === 0) return null;

  return (
    <aside
      className="hidden md:flex h-full w-48 flex-col border-r border-border bg-surface"
      aria-label={t('echoSidebar.title')}
    >
      <div className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {t('echoSidebar.title')}
      </div>
      <nav className="flex-1 overflow-y-auto px-1.5 pb-2">
        <ul className="flex flex-col gap-0.5">
          {echoList.map((echo) => (
            <li key={echo.echo_id}>
              <EchoListItem
                echo={echo}
                isActive={echo.echo_id === echoId}
                shardName={shardNameMap.get(echo.current_shard_id) ?? t('echoSidebar.unknownShard')}
                onClick={() => handleClick(echo)}
              />
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

/**
 * Mobile Echo switcher — horizontal strip at top of echo detail page.
 * Tapping shows a dropdown overlay with the full echo list.
 */
export function MobileEchoSwitcher() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { echoId } = useParams<{ echoId: string }>();
  const { echoList, fetchEchoes } = useEchoStore();
  const { shardList, fetchShards } = useShardStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (echoList.length === 0) void fetchEchoes();
  }, [echoList.length, fetchEchoes]);

  useEffect(() => {
    if (shardList.length === 0) void fetchShards();
  }, [shardList.length, fetchShards]);

  const shardNameMap = new Map(shardList.map((s) => [s.shard_id, s.name]));
  const activeEcho = echoList.find((e) => e.echo_id === echoId);

  if (echoList.length <= 1) return null;

  return (
    <div className="md:hidden">
      {/* Switcher button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm"
      >
        <div className="flex items-center gap-2 min-w-0">
          {activeEcho && (
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full"
              style={{ backgroundColor: getMoodColor(activeEcho.current_mood) }}
            />
          )}
          <span className="truncate font-medium text-text-primary">
            {activeEcho?.name ?? t('echoSidebar.selectEcho')}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown overlay */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <button
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setIsOpen(false)}
            aria-label="Close echo switcher"
            tabIndex={-1}
          />
          {/* List */}
          <div className="absolute left-0 right-0 z-50 mx-4 mt-1 rounded-lg border border-border bg-surface shadow-lg">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t('echoSidebar.switchEcho')}
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <X size={14} />
              </button>
            </div>
            <ul className="max-h-64 overflow-y-auto p-1.5">
              {echoList.map((echo) => (
                <li key={echo.echo_id}>
                  <EchoListItem
                    echo={echo}
                    isActive={echo.echo_id === echoId}
                    shardName={shardNameMap.get(echo.current_shard_id) ?? t('echoSidebar.unknownShard')}
                    onClick={() => {
                      navigate(`/echoes/${echo.echo_id}`);
                      setIsOpen(false);
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
