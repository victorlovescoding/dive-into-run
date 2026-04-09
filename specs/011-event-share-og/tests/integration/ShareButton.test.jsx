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

  beforeEach(() => {
    originalShare = navigator.share;
    // jsdom navigator.clipboard is on window — mock writeText on the actual instance
    mockWriteText = vi.fn().mockResolvedValue(undefined);
    const clipboard = window.navigator.clipboard;
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
});
