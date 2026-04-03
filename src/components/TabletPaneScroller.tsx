/**
 * TabletPaneScroller — CSS scroll-snap carousel with depth stacking.
 * No JS touch handling — browser does all scroll physics natively.
 * Cards scale down and push back in Z-space as they move from center.
 */

import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';

interface Pane {
  id: string;
  label: string;
  content: ReactNode;
}

interface Props {
  panes: Pane[];
  initialPane?: number;
}

function getPosition(index: number, active: number): string {
  const dist = Math.abs(index - active);
  if (dist === 0) return 'center';
  if (dist === 1) return 'near';
  return 'far';
}

export function TabletPaneScroller({ panes, initialPane = 0 }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(initialPane);

  // Scroll to initial pane after first paint
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const child = el.children[initialPane] as HTMLElement | undefined;
    if (child) {
      el.scrollLeft = child.offsetLeft - (el.clientWidth - child.clientWidth) / 2;
    }
  }, [initialPane]);

  // Track center card via scroll position (lightweight — no IntersectionObserver flicker)
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const center = el.scrollLeft + el.clientWidth / 2;
        let closest = 0;
        let closestDist = Infinity;
        for (let i = 0; i < el.children.length; i++) {
          const child = el.children[i] as HTMLElement;
          const childCenter = child.offsetLeft + child.offsetWidth / 2;
          const dist = Math.abs(center - childCenter);
          if (dist < closestDist) {
            closestDist = dist;
            closest = i;
          }
        }
        if (closest !== activeIndex) setActiveIndex(closest);
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  });

  const scrollTo = useCallback((index: number) => {
    const el = trackRef.current;
    if (!el) return;
    const child = el.children[index] as HTMLElement | undefined;
    if (child) {
      child.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Pills */}
      <div className="flex items-center justify-center gap-1 border-b border-border/50 bg-surface/80 px-2 py-1.5 flex-shrink-0">
        {panes.map((pane, i) => (
          <button
            key={pane.id}
            onClick={() => scrollTo(i)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-200 ${
              i === activeIndex
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {pane.label}
          </button>
        ))}
      </div>

      {/* Scroll track */}
      <div ref={trackRef} className="tablet-scroll-track">
        {panes.map((pane, i) => (
          <div
            key={pane.id}
            data-idx={i}
            data-position={getPosition(i, activeIndex)}
            className="tablet-scroll-card"
          >
            <div className="h-full rounded-xl border border-border/20 bg-canvas overflow-hidden">
              <div className="h-full overflow-y-auto overscroll-y-contain">
                {pane.content}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
