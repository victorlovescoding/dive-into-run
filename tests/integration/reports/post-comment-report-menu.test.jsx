// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CommentCard from '@/components/CommentCard';
import CommentCardMenu from '@/components/CommentCardMenu';

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
 * Creates a comment card fixture.
 * @param {Record<string, unknown>} overrides Comment field overrides.
 * @returns {Record<string, unknown>} Comment data.
 */
function createComment(overrides = {}) {
  return {
    id: 'comment-report-target',
    authorUid: 'comment-author-1',
    authorName: '留言作者',
    authorPhotoURL: 'https://example.test/comment-author.png',
    content: '可檢舉的留言',
    createdAt: null,
    updatedAt: null,
    isEdited: false,
    ...overrides,
  };
}

describe('post comment report menu entry', () => {
  it('shows report action for normal non-owner comments and sends the comment target', async () => {
    const user = userEvent.setup();
    const onReport = vi.fn();
    const comment = createComment({ id: 'normal-comment-report-target' });

    render(<CommentCard comment={comment} isOwner={false} isHighlighted={false} onReport={onReport} />);

    await user.click(screen.getByRole('button', { name: '更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '檢舉留言' }));

    expect(onReport).toHaveBeenCalledWith(comment);
  });

  it('shows report action for highlighted notification target comments without changing the target card', async () => {
    const user = userEvent.setup();
    const onReport = vi.fn();
    const comment = createComment({ id: 'notification-target-comment', content: '通知中的留言' });

    render(<CommentCard comment={comment} isOwner={false} isHighlighted onReport={onReport} />);

    expect(screen.getByRole('article')).toHaveAttribute('id', 'notification-target-comment');
    await user.click(screen.getByRole('button', { name: '更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '檢舉留言' }));

    expect(onReport).toHaveBeenCalledWith(comment);
  });

  it('does not show report action to comment owners or anonymous users', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CommentCard
        comment={createComment()}
        isOwner
        isHighlighted={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReport={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '更多操作' }));
    expect(screen.queryByRole('menuitem', { name: '檢舉留言' })).not.toBeInTheDocument();

    rerender(<CommentCard comment={createComment()} isOwner={false} isHighlighted={false} />);
    expect(screen.queryByRole('button', { name: '更多操作' })).not.toBeInTheDocument();
  });

  it('supports keyboard navigation across edit, delete, and report items', async () => {
    const user = userEvent.setup();
    const onReport = vi.fn();

    render(<CommentCardMenu onEdit={vi.fn()} onDelete={vi.fn()} onReport={onReport} />);

    await user.click(screen.getByRole('button', { name: '更多操作' }));

    const editItem = screen.getByRole('menuitem', { name: '編輯留言' });
    const deleteItem = screen.getByRole('menuitem', { name: '刪除留言' });
    const reportItem = screen.getByRole('menuitem', { name: '檢舉留言' });

    expect(editItem).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(deleteItem).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(reportItem).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onReport).toHaveBeenCalledWith();

    await user.click(screen.getByRole('button', { name: '更多操作' }));
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: '檢舉留言' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: '更多操作' })).toHaveFocus();
  });
});
