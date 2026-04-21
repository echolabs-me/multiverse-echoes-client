import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { ChevronDown } from 'lucide-react';

interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  onSelect: (id: string) => void;
  className?: string;
}

export function Dropdown({
  trigger,
  items,
  onSelect,
  className = '',
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const close = useCallback(() => {
    setOpen(false);
    setFocusIndex(-1);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, close]);

  useEffect(() => {
    if (focusIndex >= 0 && itemRefs.current[focusIndex]) {
      itemRefs.current[focusIndex]?.focus();
    }
  }, [focusIndex]);

  const handleKeyDown = (e: KeyboardEvent) => {
    const enabledItems = items.reduce<number[]>((acc, item, i) => {
      if (!item.disabled) acc.push(i);
      return acc;
    }, []);

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (!open) {
          setOpen(true);
          setFocusIndex(enabledItems[0] ?? 0);
        } else {
          const currentPos = enabledItems.indexOf(focusIndex);
          const next = enabledItems[(currentPos + 1) % enabledItems.length];
          setFocusIndex(next ?? 0);
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (open) {
          const currentPos = enabledItems.indexOf(focusIndex);
          const prev =
            enabledItems[
              (currentPos - 1 + enabledItems.length) % enabledItems.length
            ];
          setFocusIndex(prev ?? 0);
        }
        break;
      }
      case 'Escape':
        close();
        break;
      case 'Enter':
      case ' ':
        if (open && focusIndex >= 0 && !items[focusIndex]?.disabled) {
          e.preventDefault();
          onSelect(items[focusIndex]!.id);
          close();
        }
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-md bg-surface px-3 py-2 text-sm text-text-primary hover:bg-surface-raised"
      >
        {trigger}
        <ChevronDown
          size={16}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          role="listbox"
          tabIndex={-1}
          className="absolute inset-s-0 inset-bs-full z-40 mbs-1 min-w-40 rounded-lg border border-border bg-surface-raised py-1 shadow-lg"
          onKeyDown={handleKeyDown}
        >
          {items.map((item, i) => (
            <button
              key={item.id}
              ref={(el) => { itemRefs.current[i] = el; }}
              role="option"
              aria-selected={focusIndex === i}
              aria-disabled={item.disabled}
              disabled={item.disabled}
              className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-text-primary hover:bg-surface disabled:opacity-40"
              onClick={() => {
                onSelect(item.id);
                close();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
