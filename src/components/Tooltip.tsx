import { useState, useId, useRef, type ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

const positionClasses = {
  top: 'bottom-full start-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full start-1/2 -translate-x-1/2 mt-2',
  left: 'end-full top-1/2 -translate-y-1/2 me-2',
  right: 'start-full top-1/2 -translate-y-1/2 ms-2',
};

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 300,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tooltipId = useId();

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    clearTimeout(timerRef.current);
    setVisible(false);
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <div aria-describedby={visible ? tooltipId : undefined}>{children}</div>
      {visible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`pointer-events-none absolute z-40 whitespace-nowrap rounded-md bg-surface-raised px-2.5 py-1.5 text-xs text-text-primary shadow-md ${positionClasses[position]}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
