import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { OverrideDunningPhaseModal } from '../src/components/admin/billing/OverrideDunningPhaseModal.tsx';
import { adminBilling } from '../src/lib/api/endpoints.ts';
import i18n from '../src/i18n.ts';
import { ApiRequestError } from '../src/lib/api/client.ts';

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
    // The modal shows errors through the translator, which loads the app's
    // i18n, so labels are read from it rather than written as keys.
    const close = screen.getByRole('button', { name: i18n.t('common.close') });
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
    // A failure that is not the server's error carries no text for the user,
    // so the modal shows the fallback (R264).
    expect(screen.getByTestId('override-error-message')).toHaveTextContent(
      i18n.t('errors.INTERNAL_ERROR'),
    );
  });

  it("frames the server's error in one key's text, with the error as its detail (R284.5)", async () => {
    vi.mocked(adminBilling.overrideDunningState).mockRejectedValue(
      new ApiRequestError(409, 'WRONG_STATE', 'phase is lapsed'),
    );
    await act(async () => {
      render(
        <OverrideDunningPhaseModal
          open
          userId="u1"
          provider="nowpayments"
          currentPhase="active"
          onClose={() => undefined}
          onSuccess={() => undefined}
        />,
      );
    });
    await act(async () => {
      fireEvent.change(screen.getByTestId('override-reason-textarea'), {
        target: { value: 'Paid by wire' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('override-submit-button'));
    });
    expect(screen.getByTestId('override-error-message').textContent).toBe(
      i18n.t('admin.billing.override.errorDetail', {
        detail: i18n.t('errors.WRONG_STATE'),
      }),
    );
  });
});
