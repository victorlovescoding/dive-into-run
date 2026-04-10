/**
 * @file Integration tests for ShareButton — RED phase.
 * @description
 * Target component: src/components/ShareButton.jsx (does not exist yet).
 * Tests Web Share API path, clipboard fallback, error handling, and a11y.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareButton from '@/components/ShareButton';
import ToastProvider from '@/contexts/ToastContext';
import ToastContainer from '@/components/ToastContainer';

vi.mock('next/navigation', () => ({
  usePathname: () => '/events/test-id',
}));

/**
 * Render ShareButton wrapped in ToastProvider.
 * @param {{ title: string, url: string }} props - ShareButton props.
 * @returns {{ user: import('@testing-library/user-event').UserEvent }} User event instance.
 */
function renderShareButton(props) {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <ShareButton {...props} />
      <ToastContainer />
    </ToastProvider>,
  );
  return { user };
}

/** @type {{ title: string, url: string }} */
const defaultProps = {
  title: 'Weekend Trail Run',
  url: 'https://example.com/events/123',
};

describe('Integration: ShareButton', () => {
  /** @type {typeof navigator.share | undefined} */
  let originalShare;

  /** @type {import('vitest').Mock} */
  let mockWriteText;

  /** @type {boolean} */
  let matchMediaResult;

  beforeEach(() => {
    matchMediaResult = true; // 預設觸控裝置
    /** @type {(query: string) => MediaQueryList} */
    const matchMediaImpl = (query) =>
      /** @type {MediaQueryList} */ (
        /** @type {unknown} */ ({
          matches: query === '(pointer: coarse)' ? matchMediaResult : false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })
      );
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn(matchMediaImpl),
      writable: true,
      configurable: true,
    });

    originalShare = navigator.share;
    // jsdom navigator.clipboard is on window — mock writeText on the actual instance
    mockWriteText = vi.fn().mockResolvedValue(undefined);
    const { clipboard } = window.navigator;
    if (clipboard) {
      // jsdom has a real Clipboard — spy on its prototype
      const proto = Object.getPrototypeOf(clipboard);
      vi.spyOn(proto, 'writeText').mockImplementation(mockWriteText);
    } else {
      // Fallback for environments without clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true,
        configurable: true,
      });
    }
  });

  afterEach(() => {
    // Restore navigator.share
    if (originalShare === undefined) {
      delete navigator.share;
    } else {
      navigator.share = originalShare;
    }
    vi.restoreAllMocks();
  });

  /* ========================================================================
     Rendering & Accessibility
     ======================================================================== */

  it('should render a button with aria-label "分享"', () => {
    // Arrange & Act
    renderShareButton(defaultProps);

    // Assert
    const button = screen.getByRole('button', { name: '分享' });
    expect(button).toBeInTheDocument();
  });

  /* ========================================================================
     Web Share API path (navigator.share available)
     ======================================================================== */

  it('should call navigator.share when Web Share API is available', async () => {
    // Arrange
    const mockShare = vi.fn().mockResolvedValue(undefined);
    navigator.share = mockShare;
    const { user } = renderShareButton(defaultProps);

    // Act
    const button = screen.getByRole('button', { name: '分享' });
    await user.click(button);

    // Assert
    expect(mockShare).toHaveBeenCalledWith({
      title: 'Weekend Trail Run',
      url: 'https://example.com/events/123',
    });
    expect(mockShare).toHaveBeenCalledTimes(1);
  });

  /* ========================================================================
     Clipboard fallback path (no Web Share API)
     ======================================================================== */

  it('should copy URL to clipboard when Web Share API is unavailable', async () => {
    // Arrange
    delete navigator.share;
    const { user } = renderShareButton(defaultProps);

    // Act
    const button = screen.getByRole('button', { name: '分享' });
    await user.click(button);

    // Assert
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('https://example.com/events/123');
    });
  });

  it('should show success toast after clipboard copy', async () => {
    // Arrange
    delete navigator.share;
    const { user } = renderShareButton(defaultProps);

    // Act
    const button = screen.getByRole('button', { name: '分享' });
    await user.click(button);

    // Assert
    await waitFor(() => {
      expect(screen.getByText('已複製連結')).toBeInTheDocument();
    });
  });

  /* ========================================================================
     Error handling: navigator.share rejection
     ======================================================================== */

  it('should show error toast when navigator.share rejects', async () => {
    // Arrange
    const mockShare = vi.fn().mockRejectedValue(new Error('Share failed'));
    navigator.share = mockShare;
    const { user } = renderShareButton(defaultProps);

    // Act
    const button = screen.getByRole('button', { name: '分享' });
    await user.click(button);

    // Assert
    await waitFor(() => {
      expect(screen.getByText('分享失敗')).toBeInTheDocument();
    });
  });

  it('should NOT show error toast when user cancels share (AbortError)', async () => {
    // Arrange
    const abortError = new DOMException('Share canceled', 'AbortError');
    const mockShare = vi.fn().mockRejectedValue(abortError);
    navigator.share = mockShare;
    const { user } = renderShareButton(defaultProps);

    // Act
    const button = screen.getByRole('button', { name: '分享' });
    await user.click(button);

    // Assert
    expect(screen.queryByText('分享失敗')).not.toBeInTheDocument();
  });

  /* ========================================================================
     Pointer detection: desktop should not call Web Share API
     ======================================================================== */

  it('should copy URL when pointer is fine (desktop)', async () => {
    // Arrange
    matchMediaResult = false; // 桌面（pointer: fine）
    const mockShare = vi.fn().mockResolvedValue(undefined);
    navigator.share = mockShare;
    const { user } = renderShareButton(defaultProps);

    // Act
    const button = screen.getByRole('button', { name: '分享' });
    await user.click(button);

    // Assert
    expect(mockShare).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('https://example.com/events/123');
    });
    expect(screen.getByText('已複製連結')).toBeInTheDocument();
  });

  /* ========================================================================
     execCommand fallback path (clipboard API rejected)
     ======================================================================== */

  it('should fall back to execCommand when clipboard API rejects', async () => {
    // Arrange
    matchMediaResult = false; // 桌面
    delete navigator.share;
    mockWriteText.mockRejectedValueOnce(new Error('Clipboard denied'));
    if (!document.execCommand) {
      document.execCommand = () => false; // jsdom 沒有預設實作，先 stub
    }
    const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true);
    const { user } = renderShareButton(defaultProps);

    // Act
    const button = screen.getByRole('button', { name: '分享' });
    await user.click(button);

    // Assert
    await waitFor(() => {
      expect(execSpy).toHaveBeenCalledWith('copy');
    });
    expect(screen.getByText('已複製連結')).toBeInTheDocument();
  });

  it('should show error toast when both clipboard and execCommand fail', async () => {
    // Arrange
    matchMediaResult = false; // 桌面
    delete navigator.share;
    mockWriteText.mockRejectedValueOnce(new Error('Clipboard denied'));
    if (!document.execCommand) {
      document.execCommand = () => false; // jsdom 沒有預設實作，先 stub
    }
    vi.spyOn(document, 'execCommand').mockReturnValue(false);
    const { user } = renderShareButton(defaultProps);

    // Act
    const button = screen.getByRole('button', { name: '分享' });
    await user.click(button);

    // Assert
    await waitFor(() => {
      expect(screen.getByText('分享失敗')).toBeInTheDocument();
    });
    expect(screen.queryByText('已複製連結')).not.toBeInTheDocument();
  });
});
