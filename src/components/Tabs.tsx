import { useState, useRef, type ReactNode, type KeyboardEvent } from 'react';

export interface Tab {
  id: string;
  /** Tab button content. `string` works as before; passing JSX (e.g. an
   *  icon + label) lets consumers like SettingsPage render richer tabs
   *  without forking this component. */
  label: ReactNode;
  content?: ReactNode;
  testId?: string;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  activeTab?: string;
  onTabChange?: (id: string) => void;
  className?: string;
}

export function Tabs({
  tabs,
  defaultTab,
  activeTab: controlledActiveTab,
  onTabChange,
  className = '',
}: TabsProps) {
  const [internalActiveId, setInternalActiveId] = useState(
    defaultTab ?? tabs[0]?.id ?? '',
  );
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeId = controlledActiveTab ?? internalActiveId;
  const setActiveId = (id: string) => {
    if (onTabChange) {
      onTabChange(id);
    } else {
      setInternalActiveId(id);
    }
  };

  const activeTabObj = tabs.find((t) => t.id === activeId);

  const handleKeyDown = (e: KeyboardEvent, index: number) => {
    let nextIndex = index;
    switch (e.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    setActiveId(tabs[nextIndex]!.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className={className}>
      <div role="tablist" className="flex gap-1 border-be border-border">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            id={`tab-${tab.id}`}
            data-testid={tab.testId}
            aria-selected={tab.id === activeId}
            aria-controls={`panel-${tab.id}`}
            tabIndex={tab.id === activeId ? 0 : -1}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab.id === activeId
                ? 'border-be-2 border-accent text-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setActiveId(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Render an empty hidden <div role="tabpanel"> for every tab even
          when no content prop is supplied. Each tab carries
          aria-controls={`panel-${tab.id}`}, so without a matching panel
          element axe-core's aria-valid-attr-value rule fails on every
          tab whose IDREF dangles (verified Phase 2F-diag-6 §6-F on the
          Admin Dashboard tabs — that page renders content separately
          based on activeTab state and never passes `content` here).
          The active tab still gets the actual content; inactive tabs
          render an empty hidden panel that satisfies the IDREF without
          affecting layout. Backwards-compat: existing consumers that DO
          pass `content` continue to render exactly the same DOM for the
          active tab as before. */}
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        const tabContent = isActive ? activeTabObj?.content : null;
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={`panel-${tab.id}`}
            aria-labelledby={`tab-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            hidden={!isActive}
            className={isActive ? 'pbs-4' : ''}
          >
            {tabContent}
          </div>
        );
      })}
    </div>
  );
}
