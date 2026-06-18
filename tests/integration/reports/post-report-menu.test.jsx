// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PostCard from '@/components/PostCard';

vi.mock('next/image', () => ({
  default: ({ src, alt, width, height, className }) => (
    <img src={src} alt={alt} width={width} height={height} className={className} />
  ),
}));

vi.mock('next/link', () => ({
  default: ({ href, className, children, ...props }) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

/**
 * Creates a post card fixture.
 * @param {Record<string, unknown>} overrides Post field overrides.
 * @returns {Record<string, unknown>} Post card data.
 */
function createPost(overrides = {}) {
  return {
    id: 'post-report-target',
    title: '可檢舉的文章',
    content: '文章內容',
    authorUid: 'author-1',
    authorName: '作者',
    likesCount: 0,
    commentsCount: 0,
    liked: false,
    isFavorited: false,
    isAuthor: false,
    ...overrides,
  };
}

/**
 * Renders a post card with menu state open.
 * @param {Record<string, unknown>} props Prop overrides.
 * @returns {ReturnType<typeof render>} Render result.
 */
function renderOpenPostCard(props = {}) {
  const post = props.post ?? createPost();
  return render(
    <PostCard
      post={post}
      openMenuPostId={post.id}
      onToggleMenu={vi.fn()}
      onCloseMenu={vi.fn()}
      onReport={props.onReport}
      onEdit={props.onEdit}
      onDelete={props.onDelete}
    />,
  );
}

describe('post report menu entry', () => {
  it('shows report action for authenticated non-author posts and sends the post target', async () => {
    const user = userEvent.setup();
    const onReport = vi.fn();
    const post = createPost({ id: 'post-report-non-author', isAuthor: false });

    renderOpenPostCard({ post, onReport });

    await user.click(screen.getByRole('menuitem', { name: '檢舉文章' }));

    expect(onReport).toHaveBeenCalledWith(post);
  });

  it('does not show report action to target authors', () => {
    renderOpenPostCard({
      post: createPost({ isAuthor: true }),
      onReport: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });

    expect(screen.queryByRole('menuitem', { name: '檢舉文章' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '編輯' })).toBeInTheDocument();
  });

  it('does not show report action when no authenticated report handler is provided', () => {
    renderOpenPostCard({ post: createPost({ isAuthor: false }) });

    expect(screen.queryByRole('menuitem', { name: '檢舉文章' })).not.toBeInTheDocument();
  });
});
