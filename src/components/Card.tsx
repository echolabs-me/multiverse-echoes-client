import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

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

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'standard', children, className = '', ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`rounded-lg border border-border bg-surface shadow-md transition-[border-color] duration-[var(--duration-normal)] hover:border-accent ${paddingClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});
