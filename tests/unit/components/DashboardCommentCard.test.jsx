// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DashboardCommentCard from '@/components/DashboardCommentCard';

/**
 * Builds a dashboard comment fixture with stable defaults.
 * @param {Record<string, unknown>} [overrides] Comment fields to override.
 * @returns {Record<string, unknown>} Dashboard comment fixture.
 */
function makeComment(overrides = {}) {
  return {
    id: 'comment-1',
    source: 'post',
    parentId: 'parent-1',
    parentTitle: '晨跑紀錄',
    text: '這篇路線很實用',
    createdAt: '2026-06-20T08:30',
    ...overrides,
  };
}

/**
 * Sets up the comment card and returns the parent title link.
 * @param {Record<string, unknown>} [overrides] Comment fields to override.
 * @returns {HTMLElement} Rendered title link.
 */
function setupTitleLink(overrides = {}) {
  const comment = makeComment(overrides);
  render(<DashboardCommentCard comment={comment} />);

  return screen.getByRole('link', { name: String(comment.parentTitle) });
}

describe('DashboardCommentCard', () => {
  it('links post comments to the parent post with the commentId deep link', () => {
    const titleLink = setupTitleLink({
      id: 'comment-post-123',
      source: 'post',
      parentId: 'post-abc',
      parentTitle: '文章標題',
    });

    expect(titleLink).toHaveAttribute('href', '/posts/post-abc?commentId=comment-post-123');
  });

  it('links event comments to the parent event with the commentId deep link', () => {
    const titleLink = setupTitleLink({
      id: 'comment-event-456',
      source: 'event',
      parentId: 'event-def',
      parentTitle: '活動標題',
    });

    expect(titleLink).toHaveAttribute('href', '/events/event-def?commentId=comment-event-456');
  });

  it('falls back to the parent page when the comment id is missing', () => {
    for (const [index, missingId] of [undefined, null, ''].entries()) {
      const parentTitle = `缺少留言 ID ${index + 1}`;
      const { unmount } = render(
        <DashboardCommentCard
          comment={makeComment({
            id: missingId,
            parentId: 'post-no-comment-id',
            parentTitle,
          })}
        />,
      );

      const titleLink = screen.getByRole('link', { name: parentTitle });
      expect(titleLink).toHaveAttribute('href', '/posts/post-no-comment-id');
      expect(titleLink).not.toHaveAttribute(
        'href',
        expect.stringContaining('commentId=undefined'),
      );
      expect(titleLink).not.toHaveAttribute('href', expect.stringContaining('commentId=null'));

      unmount();
    }
  });

  it('encodes special characters in comment ids', () => {
    const titleLink = setupTitleLink({
      id: 'comment id/?&=',
      source: 'post',
      parentId: 'post-special',
      parentTitle: '特殊字元留言',
    });

    expect(titleLink).toHaveAttribute(
      'href',
      '/posts/post-special?commentId=comment+id%2F%3F%26%3D',
    );
  });
});
