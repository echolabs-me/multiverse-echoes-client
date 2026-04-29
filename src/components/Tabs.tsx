import { useState, useRef, type ReactNode, type KeyboardEvent } from 'react';

export interface Tab {
  id: string;
  label: string;
  content?: ReactNode;
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
      {activeTabObj?.content && (
        <div
          role="tabpanel"
          id={`panel-${activeTabObj.id}`}
          aria-labelledby={`tab-${activeTabObj.id}`}
          tabIndex={0}
          className="pbs-4"
          key={activeId}
        >
          {activeTabObj.content}
        </div>
      )}
    </div>
  );
}
