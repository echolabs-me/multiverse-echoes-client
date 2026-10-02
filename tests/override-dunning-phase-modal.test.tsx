import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { OverrideDunningPhaseModal } from '../src/components/admin/billing/OverrideDunningPhaseModal.tsx';
import { adminBilling } from '../src/lib/api/endpoints.ts';

vi.mock('../src/lib/api/endpoints.ts', () => ({
  adminBilling: { overrideDunningState: vi.fn() },
}));

vi.mock('../src/stores/useToastStore.ts', () => ({
  useToastStore: (select: (s: { addToast: () => undefined }) => unknown) =>
    select({ addToast: () => undefined }),
}));

beforeEach(() => {
  // happy-dom has no showModal: open and close the dialog by its attribute,
  // which is what makes it reachable by role.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
  vi.mocked(adminBilling.overrideDunningState).mockReset();
});

describe('OverrideDunningPhaseModal (R254.2)', () => {
  it('is busy while it submits, and its close button, Escape and the backdrop leave it open', async () => {
    let fail: (reason: unknown) => void = () => undefined;
    vi.mocked(adminBilling.overrideDunningState).mockReturnValue(
      new Promise((_, reject) => {
        fail = reject;
      }),
    );
    const onClose = vi.fn();
    await act(async () => {
      render(
        <OverrideDunningPhaseModal
          open
          userId="u1"
          provider="nowpayments"
          currentPhase="active"
          onClose={onClose}
          onSuccess={() => undefined}
        />,
      );
    });
    const dialog = screen.getByRole('dialog');
    const close = screen.getByRole('button', { name: 'common.close' });
    expect(dialog).not.toHaveAttribute('aria-busy');

    await act(async () => {
      fireEvent.change(screen.getByTestId('override-reason-textarea'), {
        target: { value: 'Paid by wire' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('override-submit-button'));
    });
    expect(adminBilling.overrideDunningState).toHaveBeenCalledTimes(1);
    expect(dialog).toHaveAttribute('aria-busy', 'true');
    expect(close).toBeDisabled();

    await act(async () => {
      fireEvent.click(close);
      fireEvent(dialog, new Event('cancel', { cancelable: true }));
      fireEvent.click(dialog);
    });
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      fail(new Error('server down'));
    });
    expect(dialog).not.toHaveAttribute('aria-busy');
    expect(close).toBeEnabled();
    expect(screen.getByTestId('override-error-message')).toHaveTextContent(
      'server down',
    );
  });
});
