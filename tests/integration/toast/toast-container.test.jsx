import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useToast } from '@/contexts/ToastContext';
import ToastContainer from '@/components/ToastContainer';

const mockUseToast = /** @type {import('vitest').Mock} */ (useToast);

vi.mock('@/contexts/ToastContext', () => ({
  useToast: vi.fn(),
}));

vi.mock('@/components/Toast', () => ({
  default: ({ toast, onClose }) => (
    <div data-testid={`toast-${toast.id}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      <span>{toast.message}</span>
      <button type="button" aria-label="關閉通知" onClick={() => onClose(toast.id)}>
        &times;
      </button>
    </div>
  ),
}));

/** @type {import('@/contexts/ToastContext').ToastItem[]} */
const mockToasts = [
  { id: 'id-1', message: '成功訊息', type: 'success', createdAt: Date.now() },
  { id: 'id-2', message: '錯誤訊息', type: 'error', createdAt: Date.now() },
  { id: 'id-3', message: '資訊訊息', type: 'info', createdAt: Date.now() },
];

describe('ToastContainer', () => {
  /** @type {import('vitest').Mock} */
  let removeToast;

  beforeEach(() => {
    removeToast = vi.fn();
  });

  // --- 1. 沒有 toasts 時不渲染任何 DOM ---
  it('renders nothing when toasts array is empty', () => {
    mockUseToast.mockReturnValue({ toasts: [], removeToast });

    const { container } = render(<ToastContainer />);

    expect(container.innerHTML).toBe('');
  });

  // --- 2. 有 toasts 時渲染所有 Toast 元件 ---
  it('renders all Toast components when toasts exist', () => {
    mockUseToast.mockReturnValue({ toasts: mockToasts, removeToast });

    render(<ToastContainer />);

    expect(screen.getByTestId('toast-id-1')).toBeInTheDocument();
    expect(screen.getByTestId('toast-id-2')).toBeInTheDocument();
    expect(screen.getByTestId('toast-id-3')).toBeInTheDocument();
  });

  // --- 3. 容器有 aria-live="polite" 屬性 ---
  it('has aria-live="polite" on the container', () => {
    mockUseToast.mockReturnValue({ toasts: mockToasts, removeToast });

    render(<ToastContainer />);

    const container = screen.getByRole('region', { name: '通知列表' });
    expect(container).toHaveAttribute('aria-live', 'polite');
  });

  // --- 4. 點擊 Toast 關閉按鈕呼叫 removeToast ---
  it('calls removeToast when Toast close button is clicked', async () => {
    const user = userEvent.setup();
    mockUseToast.mockReturnValue({ toasts: mockToasts, removeToast });

    render(<ToastContainer />);

    const closeButtons = screen.getAllByRole('button', { name: '關閉通知' });
    await user.click(closeButtons[0]);

    expect(removeToast).toHaveBeenCalledWith('id-1');
    expect(removeToast).toHaveBeenCalledTimes(1);
  });
});
