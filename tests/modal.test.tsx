import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { Modal } from '../src/components/Modal.tsx';

/** A parent that closes the modal when asked, or one that keeps it open
 *  (as a working notice does). */
function Parent({ closes, busy }: { closes: boolean; busy?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <Modal
      open={open}
      onClose={() => closes && setOpen(false)}
      title="Notice"
      busy={busy}
    >
      <p>body</p>
    </Modal>
  );
}

/** What a browser does on a repeated Escape: a `cancel` the page cannot
 *  prevent, and then, in a later task, the dialog closes. */
async function browserCloses(dialog: HTMLElement) {
  await act(async () => {
    fireEvent(dialog, new Event('cancel', { cancelable: false }));
  });
  await act(async () => {
    (dialog as HTMLDialogElement).close();
    fireEvent(dialog, new Event('close'));
  });
}

const showModal = vi.fn();

beforeEach(() => {
  showModal.mockReset();
  // happy-dom has no showModal: open and close the dialog by its attribute,
  // which is what makes it reachable by role.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    showModal();
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

describe('Modal, when the browser closes it (R253.3)', () => {
  it('is shown again while its parent keeps it open', async () => {
    await act(async () => {
      render(<Parent closes={false} />);
    });
    const dialog = screen.getByRole('dialog', { name: 'Notice' });

    await browserCloses(dialog);
    expect(screen.queryByRole('dialog', { name: 'Notice' })).not.toBeNull();
    expect(showModal).toHaveBeenCalledTimes(2);
  });

  it('stays closed when its parent closes it', async () => {
    await act(async () => {
      render(<Parent closes />);
    });
    const dialog = screen.getByRole('dialog', { name: 'Notice' });

    await browserCloses(dialog);
    expect(screen.queryByRole('dialog', { name: 'Notice' })).toBeNull();
    expect(showModal).toHaveBeenCalledTimes(1);
  });
});

describe('Modal, while busy (R254.1)', () => {
  function renderModal(busy: boolean) {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Notice" busy={busy}>
        <p>body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Notice' });
    const close = screen.getByRole('button', { name: 'common.close' });
    return { onClose, dialog, close };
  }

  function dismissEachWay(dialog: HTMLElement, close: HTMLElement) {
    act(() => {
      fireEvent(dialog, new Event('cancel', { cancelable: true }));
    });
    act(() => {
      fireEvent.click(dialog);
    });
    act(() => {
      fireEvent.click(close);
    });
  }

  it('disables its close button and carries aria-busy', () => {
    const { dialog, close } = renderModal(true);
    expect(close).toBeDisabled();
    expect(dialog).toHaveAttribute('aria-busy', 'true');
  });

  it('is not closed by Escape, the backdrop or its close button', () => {
    const { onClose, dialog, close } = renderModal(true);
    dismissEachWay(dialog, close);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Notice' })).not.toBeNull();
  });

  it('when not busy, is closed by Escape, the backdrop and its close button', () => {
    const { onClose, dialog, close } = renderModal(false);
    expect(close).toBeEnabled();
    expect(dialog).not.toHaveAttribute('aria-busy');
    dismissEachWay(dialog, close);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('a click on its content does not close it', () => {
    const { onClose } = renderModal(false);
    act(() => {
      fireEvent.click(screen.getByText('body'));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('is shown again when the browser closes it, though its parent would close it when asked', async () => {
    await act(async () => {
      render(<Parent closes busy />);
    });
    const dialog = screen.getByRole('dialog', { name: 'Notice' });

    await browserCloses(dialog);
    expect(screen.queryByRole('dialog', { name: 'Notice' })).not.toBeNull();
    expect(showModal).toHaveBeenCalledTimes(2);
  });
});
