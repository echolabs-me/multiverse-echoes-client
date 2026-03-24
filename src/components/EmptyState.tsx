import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 text-center ${className}`}
    >
      <div className="mb-4 text-text-muted">
        {icon ?? <Inbox size={48} strokeWidth={1.5} aria-hidden="true" />}
      </div>
      <h3 className="mb-1 text-lg font-medium text-text-primary">{title}</h3>
      {description && (
        <p className="mb-4 max-w-sm text-sm text-text-secondary">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
