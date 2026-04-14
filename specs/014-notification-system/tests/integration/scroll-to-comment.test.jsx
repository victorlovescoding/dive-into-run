import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useEffect } from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => '/posts/123'),
}));

import { useSearchParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Test component — 模擬 PostDetailClient 中 scroll-to-comment 的 useEffect 行為
// ---------------------------------------------------------------------------

/**
 * 測試用元件，包含一個可被捲動到的留言目標。
 * 使用與 PostDetailClient 相同的 scroll-to-comment 邏輯模式。
 * @returns {import('react').JSX.Element} 測試元件。
 */
function ScrollTestComponent() {
  const searchParams = useSearchParams();
  const commentId = searchParams.get('commentId');

  useEffect(() => {
    if (!commentId) return undefined;

    const timer = setTimeout(() => {
      const el = document.getElementById(commentId);
      if (!el) return;

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('commentHighlight');

      /** 動畫結束後移除高亮 class。 */
      const handleAnimationEnd = () => {
        el.classList.remove('commentHighlight');
      };
      el.addEventListener('animationend', handleAnimationEnd);
    }, 300);

    return () => clearTimeout(timer);
  }, [commentId]);

  return (
    <div>
      <div id="cmt-123">Target Comment</div>
    </div>
  );
}

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
    const { container } = render(<ScrollTestComponent />);
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Assert
    const target = container.querySelector('#cmt-123');
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
    const { container } = render(<ScrollTestComponent />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const target = container.querySelector('#cmt-123');

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
