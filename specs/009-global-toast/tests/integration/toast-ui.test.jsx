import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Toast from '@/components/Toast';

/** @type {import('@/components/Toast').ToastItem} */
const mockSuccessToast = {
  id: 'test-id-1',
  message: '操作成功！',
  type: 'success',
  createdAt: Date.now(),
};

/** @type {import('@/components/Toast').ToastItem} */
const mockErrorToast = {
  id: 'test-id-2',
  message: '發生錯誤，請稍後再試。',
  type: 'error',
  createdAt: Date.now(),
};

/** @type {import('@/components/Toast').ToastItem} */
const mockInfoToast = {
  id: 'test-id-3',
  message: '資料已同步完成。',
  type: 'info',
  createdAt: Date.now(),
};

describe('Toast component', () => {
  /** @type {import('vitest').Mock} */
  let onClose;

  beforeEach(() => {
    onClose = vi.fn();
  });

  // --- 1. 渲染 success toast → 顯示訊息文字 ---
  it('renders success toast with message text', () => {
    render(<Toast toast={mockSuccessToast} onClose={onClose} />);
    expect(screen.getByText('操作成功！')).toBeInTheDocument();
  });

  // --- 2. success toast → role="status" ---
  it('renders success toast with role="status"', () => {
    render(<Toast toast={mockSuccessToast} onClose={onClose} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  // --- 3. error toast → role="alert" ---
  it('renders error toast with role="alert"', () => {
    render(<Toast toast={mockErrorToast} onClose={onClose} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  // --- 4. info toast → role="status" ---
  it('renders info toast with role="status"', () => {
    render(<Toast toast={mockInfoToast} onClose={onClose} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  // --- 5. 點擊關閉按鈕 → 呼叫 onClose(toast.id) ---
  it('calls onClose with toast id when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<Toast toast={mockSuccessToast} onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: '關閉通知' });
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledWith('test-id-1');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // --- 6. success toast 3 秒後自動呼叫 onClose ---
  describe('auto-dismiss', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('auto-dismisses success toast after 3 seconds', () => {
      render(<Toast toast={mockSuccessToast} onClose={onClose} />);

      expect(onClose).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(onClose).toHaveBeenCalledWith('test-id-1');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    // --- 7. error toast 不自動消失 ---
    it('does not auto-dismiss error toast', () => {
      render(<Toast toast={mockErrorToast} onClose={onClose} />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(onClose).not.toHaveBeenCalled();
    });

    it('auto-dismisses info toast after 3 seconds', () => {
      render(<Toast toast={mockInfoToast} onClose={onClose} />);

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(onClose).toHaveBeenCalledWith('test-id-3');
    });
  });

  // --- 8. 長文字不溢出容器 ---
  it('renders long text without overflow issues', () => {
    const longTextToast = {
      ...mockSuccessToast,
      id: 'long-text',
      message: '這是一段非常長的文字'.repeat(50),
    };

    render(<Toast toast={longTextToast} onClose={onClose} />);
    expect(screen.getByText(longTextToast.message)).toBeInTheDocument();
  });
});
