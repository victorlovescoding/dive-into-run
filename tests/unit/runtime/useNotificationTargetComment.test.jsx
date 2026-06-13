// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useNotificationTargetComment from '../../../src/runtime/hooks/useNotificationTargetComment';

const initialComment = {
  id: 'comment-initial',
  content: '初始留言',
};

const fetchedComment = {
  id: 'comment-target',
  comment: '通知留言',
};

/**
 * Normalizes raw comments into the shared card-facing shape.
 * @param {object} comment - Raw comment data.
 * @returns {object} Normalized comment.
 */
function normalizeComment(comment) {
  return {
    ...comment,
    content: comment.content ?? comment.comment ?? '',
  };
}

/**
 * Reads the stable id from a comment-like object.
 * @param {object} comment - Comment-like object.
 * @returns {string} Comment id.
 */
function getCommentId(comment) {
  return comment.id;
}

describe('useNotificationTargetComment', () => {
  let loadCommentById;

  beforeEach(() => {
    loadCommentById = vi.fn().mockResolvedValue(fetchedComment);
  });

  it('fetches and pins a URL target that is missing from the current page', async () => {
    const { result } = renderHook(() =>
      useNotificationTargetComment({
        targetCommentId: 'comment-target',
        submittedCommentId: null,
        comments: [initialComment],
        loadCommentById,
        normalizeComment,
        getCommentId,
      }),
    );

    await waitFor(() => expect(result.current.pinnedComment?.id).toBe('comment-target'));

    expect(loadCommentById).toHaveBeenCalledWith('comment-target');
    expect(result.current.pinnedComment).toMatchObject({
      id: 'comment-target',
      content: '通知留言',
    });
    expect(result.current.visibleComments).toEqual([initialComment]);
    expect(result.current.activeTargetId).toBe('comment-target');
  });

  it('pins an already loaded target without duplicating it in visible comments', () => {
    const { result } = renderHook(() =>
      useNotificationTargetComment({
        targetCommentId: 'comment-initial',
        submittedCommentId: null,
        comments: [initialComment],
        loadCommentById,
        normalizeComment,
        getCommentId,
      }),
    );

    expect(loadCommentById).not.toHaveBeenCalled();
    expect(result.current.pinnedComment).toEqual(initialComment);
    expect(result.current.visibleComments).toEqual([]);
  });

  it('silently no-ops when the target comment cannot be loaded', async () => {
    loadCommentById.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useNotificationTargetComment({
        targetCommentId: 'comment-missing',
        submittedCommentId: null,
        comments: [initialComment],
        loadCommentById,
        normalizeComment,
        getCommentId,
      }),
    );

    await waitFor(() => expect(loadCommentById).toHaveBeenCalledWith('comment-missing'));

    expect(result.current.pinnedComment).toBeNull();
    expect(result.current.visibleComments).toEqual([initialComment]);
    expect(result.current.activeTargetId).toBe('comment-missing');
  });

  it('lets a local submission override the URL target and clears URL pinning', () => {
    const { result } = renderHook(() =>
      useNotificationTargetComment({
        targetCommentId: 'comment-target',
        submittedCommentId: 'comment-submitted',
        comments: [initialComment],
        loadCommentById,
        normalizeComment,
        getCommentId,
      }),
    );

    expect(loadCommentById).not.toHaveBeenCalled();
    expect(result.current.pinnedComment).toBeNull();
    expect(result.current.visibleComments).toEqual([initialComment]);
    expect(result.current.activeTargetId).toBe('comment-submitted');
  });
});
