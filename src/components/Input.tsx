import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface BaseInputProps {
  label?: string;
  error?: string;
}

type InputProps = BaseInputProps &
  InputHTMLAttributes<HTMLInputElement> & { multiline?: false };

type TextareaProps = BaseInputProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true };

const inputClasses =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors duration-[var(--duration-fast)] focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none disabled:opacity-40 disabled:pointer-events-none';

const errorClasses = 'border-danger focus:border-danger focus:ring-danger/30';

export const Input = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  InputProps | TextareaProps
>(function Input(props, ref) {
  const { label, error, multiline, className = '', id, ...rest } = props;
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-text-secondary"
        >
          {label}
        </label>
      )}
      {multiline ? (
        <textarea
          ref={ref as React.Ref<HTMLTextAreaElement>}
          id={inputId}
          className={`${inputClasses} min-h-[80px] resize-y ${error ? errorClasses : ''} ${className}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          ref={ref as React.Ref<HTMLInputElement>}
          id={inputId}
          className={`${inputClasses} ${error ? errorClasses : ''} ${className}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
