import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Toast from '@/components/Toast';
import ToastProvider, { useToast } from '@/runtime/providers/ToastProvider';

vi.mock('next/navigation', () => ({
  usePathname: () => '/toast-undo-test',
}));

/**
 * Renders controls that exercise the toast provider through the public hook API.
 * @returns {import('react').ReactElement} Test-only toast controls and rendered toasts.
 */
function ToastTestHarness() {
  const { toasts, showToast, removeToast } = useToast();
  const undoAction = {
    label: '復原',
    callback: vi.fn(),
  };

  return (
    <>
      <button type="button" onClick={() => showToast('訊息', 'success')}>
        顯示 legacy toast
      </button>
      <button type="button" onClick={() => showToast('已取消收藏', 'success', undoAction)}>
        顯示 undo toast
      </button>
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </>
  );
}

/**
 * Renders the shared toast harness inside the provider under test.
 * @returns {import('@testing-library/react').RenderResult} Testing Library render result.
 */
function renderToastHarness() {
  return render(
    <ToastProvider>
      <ToastTestHarness />
    </ToastProvider>,
  );
}

describe('Toast undo actions', () => {
  it('renders legacy showToast message and type calls', async () => {
    const user = userEvent.setup();
    renderToastHarness();

    await user.click(screen.getByRole('button', { name: '顯示 legacy toast' }));

    expect(screen.getByRole('status')).toHaveTextContent('訊息');
    expect(screen.queryByRole('button', { name: '復原' })).not.toBeInTheDocument();
  });

  it('renders an optional toast action button', async () => {
    const user = userEvent.setup();
    renderToastHarness();

    await user.click(screen.getByRole('button', { name: '顯示 undo toast' }));

    expect(screen.getByRole('status')).toHaveTextContent('已取消收藏');
    expect(screen.getByRole('button', { name: '復原' })).toBeInTheDocument();
  });

  it('invokes the toast action callback once when clicked', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();

    /**
     * Renders a toast action wired to this test's spy callback.
     * @returns {import('react').ReactElement} Test-only action harness.
     */
    function ActionHarness() {
      const { toasts, showToast, removeToast } = useToast();
      return (
        <>
          <button
            type="button"
            onClick={() => showToast('已取消收藏', 'success', { label: '復原', callback: onUndo })}
          >
            顯示 undo toast
          </button>
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onClose={removeToast} />
          ))}
        </>
      );
    }

    render(
      <ToastProvider>
        <ActionHarness />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: '顯示 undo toast' }));
    await user.click(screen.getByRole('button', { name: '復原' }));

    expect(onUndo).toHaveBeenCalledOnce();
  });

  it('removes the toast through the existing close button', async () => {
    const user = userEvent.setup();
    renderToastHarness();

    await user.click(screen.getByRole('button', { name: '顯示 legacy toast' }));
    await user.click(screen.getByRole('button', { name: '關閉通知' }));

    expect(screen.queryByText('訊息')).not.toBeInTheDocument();
  });
});
