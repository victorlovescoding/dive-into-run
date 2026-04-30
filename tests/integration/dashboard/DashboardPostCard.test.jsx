import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import DashboardPostCard from '@/components/DashboardPostCard';

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
 * @param {Partial<import('@/lib/firebase-posts').Post>} overrides - 覆蓋預設值的欄位。
 * @returns {import('@/lib/firebase-posts').Post} 組合後的 mock Post。
 */
function makePost(overrides = {}) {
  return {
    id: 'post-1',
    authorUid: 'user-1',
    title: '週末河濱跑步心得',
    content: '今天跑了 10K，配速 5:30...',
    postAt: /** @type {any} */ (fakeTimestamp(2025, 5, 15, 8, 30)),
    likesCount: 42,
    commentsCount: 7,
    ...overrides,
  };
}

describe('DashboardPostCard', () => {
  it('renders title as link pointing to /posts/{id}', () => {
    // Arrange
    const post = makePost();

    // Act
    render(<DashboardPostCard post={post} />);

    // Assert
    const link = screen.getByRole('link', { name: '週末河濱跑步心得' });
    expect(link).toHaveAttribute('href', '/posts/post-1');
  });

  it('renders formatted postAt', () => {
    // Arrange
    const post = makePost();

    // Act
    render(<DashboardPostCard post={post} />);

    // Assert
    expect(screen.getByText('2025-06-15 08:30')).toBeInTheDocument();
  });

  it('renders likesCount', () => {
    // Arrange
    const post = makePost({ likesCount: 42 });

    // Act
    render(<DashboardPostCard post={post} />);

    // Assert
    expect(screen.getByText(/讚 42/)).toBeInTheDocument();
  });

  it('renders commentsCount', () => {
    // Arrange
    const post = makePost({ commentsCount: 7 });

    // Act
    render(<DashboardPostCard post={post} />);

    // Assert
    expect(screen.getByText(/留言 7/)).toBeInTheDocument();
  });

  it('renders likesCount as 0 correctly', () => {
    // Arrange
    const post = makePost({ likesCount: 0 });

    // Act
    render(<DashboardPostCard post={post} />);

    // Assert
    expect(screen.getByText(/讚 0/)).toBeInTheDocument();
  });

  it('renders commentsCount as 0 correctly', () => {
    // Arrange
    const post = makePost({ commentsCount: 0 });

    // Act
    render(<DashboardPostCard post={post} />);

    // Assert
    expect(screen.getByText(/留言 0/)).toBeInTheDocument();
  });
});
