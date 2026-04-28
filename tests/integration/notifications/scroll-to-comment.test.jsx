import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => '/posts/123'),
}));

import { useSearchParams } from 'next/navigation';
import ScrollTestComponent from '../../_helpers/notifications/scroll-to-comment-mock';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scroll-to-comment', () => {
  /** @type {import('vitest').Mock} */
  let mockScrollIntoView;

  beforeEach(() => {
    vi.useFakeTimers();
    mockScrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = mockScrollIntoView;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete Element.prototype.scrollIntoView;
  });

  it('scrolls to comment and adds highlight class when commentId is present', () => {
    // Arrange
    const mockSearchParams = new URLSearchParams('commentId=cmt-123');
    /** @type {import('vitest').Mock} */ (useSearchParams).mockReturnValue(mockSearchParams);

    // Act
    render(<ScrollTestComponent />);
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Assert
    const target = screen.getByText('Target Comment');
    expect(mockScrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
    expect(target.classList.contains('commentHighlight')).toBe(true);
  });

  it('removes highlight class after animation ends', () => {
    // Arrange
    const mockSearchParams = new URLSearchParams('commentId=cmt-123');
    /** @type {import('vitest').Mock} */ (useSearchParams).mockReturnValue(mockSearchParams);

    // Act
    render(<ScrollTestComponent />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const target = screen.getByText('Target Comment');

    // Simulate animation end
    act(() => {
      target.dispatchEvent(new Event('animationend'));
    });

    // Assert
    expect(target.classList.contains('commentHighlight')).toBe(false);
  });

  it('does not scroll when commentId is absent', () => {
    // Arrange
    const mockSearchParams = new URLSearchParams('');
    /** @type {import('vitest').Mock} */ (useSearchParams).mockReturnValue(mockSearchParams);

    // Act
    render(<ScrollTestComponent />);
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Assert
    expect(mockScrollIntoView).not.toHaveBeenCalled();
  });

  it('does not scroll when element is not found', () => {
    // Arrange
    const mockSearchParams = new URLSearchParams('commentId=nonexistent');
    /** @type {import('vitest').Mock} */ (useSearchParams).mockReturnValue(mockSearchParams);

    // Act — component doesn't have element with id="nonexistent"
    render(<ScrollTestComponent />);
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Assert
    expect(mockScrollIntoView).not.toHaveBeenCalled();
  });
});
