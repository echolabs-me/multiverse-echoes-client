import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  closeTestId?: string;
  /** True while the dialog's parent keeps it open as it works: the close
   *  button is disabled, the dialog carries `aria-busy`, and Escape and the
   *  backdrop do not close it (R254.1). */
  busy?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className = '',
  closeTestId,
  busy = false,
}: ModalProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      dialog.showModal();
    } else {
      dialog.close();
      previousFocusRef.current?.focus();
    }
  }, [open]);

  // Escape (the dialog's native `cancel`) and a click on the backdrop are the
  // two ways to dismiss it, and neither does while it is busy. A click on the
  // backdrop lands on the dialog itself; a click on its content lands on a
  // child.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      if (!busy) onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (e.target === dialog && !busy) onClose();
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleClick);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleClick);
    };
  }, [onClose, busy]);

  // The browser closes a modal dialog on a repeated Escape even when its
  // `cancel` is prevented. While `open` is still true the dialog is shown
  // again, so a parent that keeps it open, such as a notice that is working,
  // keeps it open (R253.3).
  const openRef = useRef(open);
  useLayoutEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      if (openRef.current) dialog.showModal();
    };

    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`max-w-lg rounded-lg border border-border bg-surface p-0 shadow-lg backdrop:bg-black/50 open:animate-modal-in ${className}`}
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
    >
      <div className="flex items-center justify-between border-be border-border px-6 py-4">
        <h2 id={titleId} className="text-lg font-semibold text-text-primary">
          {title}
        </h2>
        <button
          onClick={onClose}
          disabled={busy}
          data-testid={closeTestId}
          className="transition-color-opacity rounded-md p-1 text-text-muted hover:text-text-primary disabled:pointer-events-none disabled:opacity-40"
          aria-label={t('common.close')}
        >
          <X size={20} />
        </button>
      </div>
      <div className="px-6 py-4">{children}</div>
    </dialog>
  );
}
