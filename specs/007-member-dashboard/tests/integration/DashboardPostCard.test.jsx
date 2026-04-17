import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/link', () => ({
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

vi.mock('@/lib/event-helpers', () => ({
  formatDateTime: vi.fn(),
}));

/** @type {import('vitest').Mock} */
const mockFormatDateTime = /** @type {any} */ (await import('@/lib/event-helpers')).formatDateTime;

/**
 * @param overrides
 * @returns {import('@/lib/firebase-posts').Post}
 */
function makePost(overrides = {}) {
  return {
    id: 'post-1',
    authorUid: 'user-1',
    title: '週末河濱跑步心得',
    content: '今天跑了 10K，配速 5:30...',
    postAt: /** @type {any} */ ({ toDate: () => new Date('2025-06-15T08:30:00') }),
    likesCount: 42,
    commentsCount: 7,
    ...overrides,
  };
}

describe('DashboardPostCard', () => {
  /** @type {typeof import('@/components/DashboardPostCard').default} */
  let DashboardPostCard;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFormatDateTime.mockReturnValue('2025-06-15 08:30');
    DashboardPostCard = (await import('@/components/DashboardPostCard')).default;
  });

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
    expect(mockFormatDateTime).toHaveBeenCalledWith(post.postAt);
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
