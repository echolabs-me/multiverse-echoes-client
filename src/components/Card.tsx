import type { HTMLAttributes, ReactNode } from 'react';

type CardVariant = 'compact' | 'standard' | 'spacious';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  children: ReactNode;
}

const paddingClasses: Record<CardVariant, string> = {
  compact: 'p-4',
  standard: 'p-6',
  spacious: 'p-8',
};

export function Card({
  variant = 'standard',
  children,
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-lg border border-border bg-surface shadow-md transition-[border-color] duration-[var(--duration-normal)] hover:border-accent ${paddingClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
