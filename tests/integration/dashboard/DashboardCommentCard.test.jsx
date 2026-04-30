import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import DashboardCommentCard from '@/components/DashboardCommentCard';

vi.mock('next/link', () => ({
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

/**
 * 建立一個假的 Firestore Timestamp。
 * @param {number} year - 年。
 * @param {number} monthIndex - 0-based 月份。
 * @param {number} day - 日。
 * @param {number} hour - 時。
 * @param {number} minute - 分。
 * @returns {{ toDate: () => Date }} 假 Timestamp。
 */
function fakeTimestamp(year, monthIndex, day, hour, minute) {
  return {
    toDate: () => new Date(year, monthIndex, day, hour, minute),
  };
}

/**
 * 建立預設留言資料。
 * @param {Partial<import('@/lib/firebase-member').MyCommentItem>} [overrides] - 覆蓋欄位。
 * @returns {import('@/lib/firebase-member').MyCommentItem} 留言資料。
 */
function createComment(overrides = {}) {
  return {
    id: 'c1',
    source: 'post',
    parentId: 'p1',
    parentTitle: '晨跑心得分享',
    text: '這篇文章寫得很好，讓我學到很多跑步技巧！',
    createdAt: /** @type {any} */ (fakeTimestamp(2025, 5, 15, 14, 30)),
    ...overrides,
  };
}

describe('DashboardCommentCard', () => {
  it('source=post 時顯示「文章」badge', () => {
    // Arrange
    const comment = createComment({ source: 'post' });

    // Act
    render(<DashboardCommentCard comment={comment} />);

    // Assert
    expect(screen.getByText('文章')).toBeInTheDocument();
  });

  it('source=event 時顯示「活動」badge', () => {
    // Arrange
    const comment = createComment({ source: 'event' });

    // Act
    render(<DashboardCommentCard comment={comment} />);

    // Assert
    expect(screen.getByText('活動')).toBeInTheDocument();
  });

  it('source=post 時 parentTitle link 指向 /posts/{parentId}', () => {
    // Arrange
    const comment = createComment({ source: 'post', parentId: 'abc123' });

    // Act
    render(<DashboardCommentCard comment={comment} />);

    // Assert
    const link = screen.getByRole('link', { name: comment.parentTitle });
    expect(link).toHaveAttribute('href', '/posts/abc123');
  });

  it('source=event 時 parentTitle link 指向 /events/{parentId}', () => {
    // Arrange
    const comment = createComment({
      source: 'event',
      parentId: 'evt456',
      parentTitle: '週末河濱長跑',
    });

    // Act
    render(<DashboardCommentCard comment={comment} />);

    // Assert
    const link = screen.getByRole('link', { name: '週末河濱長跑' });
    expect(link).toHaveAttribute('href', '/events/evt456');
  });

  it('渲染 comment text', () => {
    // Arrange
    const comment = createComment({ text: '好棒的活動！' });

    // Act
    render(<DashboardCommentCard comment={comment} />);

    // Assert
    expect(screen.getByText('好棒的活動！')).toBeInTheDocument();
  });

  it('渲染 formatted createdAt', () => {
    // Arrange
    const ts = /** @type {any} */ (fakeTimestamp(2025, 5, 15, 14, 30));
    const comment = createComment({ createdAt: ts });

    // Act
    render(<DashboardCommentCard comment={comment} />);

    // Assert
    expect(screen.getByText('2025-06-15 14:30')).toBeInTheDocument();
  });

  it('comment text 有 line-clamp class', () => {
    // Arrange
    const comment = createComment();

    // Act
    render(<DashboardCommentCard comment={comment} />);

    // Assert
    const textEl = screen.getByText(comment.text);
    expect(textEl.className).toMatch(/lineClamp/);
  });
});
