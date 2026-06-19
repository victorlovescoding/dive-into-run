// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useComments from '@/runtime/hooks/useComments';

const mocks = vi.hoisted(() => ({
  fetchComments: vi.fn(),
}));

vi.mock('../../../src/runtime/client/use-cases/event-comment-use-cases', () => ({
  fetchComments: mocks.fetchComments,
}));

/**
 * Creates a manually controlled promise for async race assertions.
 * @returns {{
 *   promise: Promise<unknown>,
 *   resolve: (value: unknown) => void,
 *   reject: (reason?: unknown) => void
 * }} Deferred promise controls.
 */
function createDeferred() {
  /** @type {(value: unknown) => void} */
  let resolve = () => {};
  /** @type {(reason?: unknown) => void} */
  let reject = () => {};
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

/**
 * Builds a normalized event comment fixture.
 * @param {string} id - Comment ID.
 * @returns {import('@/service/event-comment-service').CommentData} Event comment.
 */
function comment(id) {
  return {
    id,
    authorUid: 'user-1',
    authorName: '跑者一號',
    authorPhotoURL: 'https://example.test/avatar.png',
    content: `留言 ${id}`,
    createdAt: { seconds: 100 },
    updatedAt: null,
    isEdited: false,
  };
}

/**
 * Builds a snapshot-like cursor.
 * @param {string} id - Cursor ID.
 * @returns {{ id: string }} Cursor fixture.
 */
function cursor(id) {
  return { id };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useComments event comment pagination state', () => {
  it('uses explicit hasMore from fetchComments instead of deriving it from lastDoc', async () => {
    mocks.fetchComments.mockResolvedValueOnce({
      comments: [comment('event-comment-1')],
      lastDoc: null,
      hasMore: true,
    });

    const { result } = renderHook(() => useComments('event-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(true);
  });

  it('blocks duplicate load-more requests for the same cursor before loading state rerenders', async () => {
    const firstCursor = cursor('event-comment-1');
    const pendingMore = createDeferred();
    mocks.fetchComments
      .mockResolvedValueOnce({
        comments: [comment('event-comment-1')],
        lastDoc: firstCursor,
        hasMore: true,
      })
      .mockReturnValueOnce(pendingMore.promise);

    const { result } = renderHook(() => useComments('event-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.retryLoadMore();
      result.current.retryLoadMore();
    });

    expect(mocks.fetchComments).toHaveBeenNthCalledWith(2, 'event-1', {
      afterDoc: firstCursor,
      limitCount: 15,
    });
    expect(mocks.fetchComments).not.toHaveBeenNthCalledWith(3, 'event-1', {
      afterDoc: firstCursor,
      limitCount: 15,
    });

    await act(async () => {
      pendingMore.resolve({
        comments: [comment('event-comment-2')],
        lastDoc: null,
        hasMore: false,
      });
    });
  });

  it('dedupes appended load-more comments by id', async () => {
    const firstCursor = cursor('event-comment-1');
    mocks.fetchComments
      .mockResolvedValueOnce({
        comments: [comment('event-comment-1')],
        lastDoc: firstCursor,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        comments: [comment('event-comment-1'), comment('event-comment-2')],
        lastDoc: null,
        hasMore: false,
      });

    const { result } = renderHook(() => useComments('event-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.retryLoadMore();
    });

    await waitFor(() =>
      expect(result.current.comments.map((item) => item.id)).toEqual([
        'event-comment-1',
        'event-comment-2',
      ]),
    );
  });

  it('ignores stale load-more results after eventId changes', async () => {
    const firstCursor = cursor('event-1-cursor');
    const pendingMore = createDeferred();
    mocks.fetchComments
      .mockResolvedValueOnce({
        comments: [comment('event-1-initial')],
        lastDoc: firstCursor,
        hasMore: true,
      })
      .mockReturnValueOnce(pendingMore.promise)
      .mockResolvedValueOnce({
        comments: [comment('event-2-initial')],
        lastDoc: null,
        hasMore: false,
      });

    const { result, rerender } = renderHook(({ eventId }) => useComments(eventId), {
      initialProps: { eventId: 'event-1' },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.retryLoadMore();
    });
    rerender({ eventId: 'event-2' });
    await waitFor(() => expect(mocks.fetchComments).toHaveBeenLastCalledWith('event-2'));

    await act(async () => {
      pendingMore.resolve({
        comments: [comment('event-1-more')],
        lastDoc: null,
        hasMore: false,
      });
    });

    expect(result.current.comments.map((item) => item.id)).not.toContain('event-1-more');
  });

  it('clears load-more loading state when eventId changes with a request pending', async () => {
    const firstCursor = cursor('event-1-cursor');
    const pendingMore = createDeferred();
    mocks.fetchComments
      .mockResolvedValueOnce({
        comments: [comment('event-1-initial')],
        lastDoc: firstCursor,
        hasMore: true,
      })
      .mockReturnValueOnce(pendingMore.promise)
      .mockResolvedValueOnce({
        comments: [comment('event-2-initial')],
        lastDoc: null,
        hasMore: false,
      });

    const { result, rerender } = renderHook(({ eventId }) => useComments(eventId), {
      initialProps: { eventId: 'event-1' },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.retryLoadMore();
    });
    await waitFor(() => expect(result.current.isLoadingMore).toBe(true));

    rerender({ eventId: 'event-2' });
    await waitFor(() => expect(mocks.fetchComments).toHaveBeenLastCalledWith('event-2'));

    expect(result.current.isLoadingMore).toBe(false);

    await act(async () => {
      pendingMore.resolve({
        comments: [comment('event-1-more')],
        lastDoc: null,
        hasMore: false,
      });
    });
  });

  it('does not carry previous event comments into a new event initial load', async () => {
    mocks.fetchComments
      .mockResolvedValueOnce({
        comments: [comment('event-1-initial')],
        lastDoc: null,
        hasMore: false,
      })
      .mockResolvedValueOnce({
        comments: [comment('event-2-initial')],
        lastDoc: null,
        hasMore: false,
      });

    const { result, rerender } = renderHook(({ eventId }) => useComments(eventId), {
      initialProps: { eventId: 'event-1' },
    });
    await waitFor(() => expect(result.current.comments).toHaveLength(1));

    rerender({ eventId: 'event-2' });

    await waitFor(() =>
      expect(result.current.comments.map((item) => item.id)).toEqual(['event-2-initial']),
    );
  });

  it('ignores stale retryLoad results after eventId changes', async () => {
    const pendingRetry = createDeferred();
    mocks.fetchComments
      .mockResolvedValueOnce({
        comments: [comment('event-1-initial')],
        lastDoc: null,
        hasMore: false,
      })
      .mockReturnValueOnce(pendingRetry.promise)
      .mockResolvedValueOnce({
        comments: [comment('event-2-initial')],
        lastDoc: null,
        hasMore: false,
      });

    const { result, rerender } = renderHook(({ eventId }) => useComments(eventId), {
      initialProps: { eventId: 'event-1' },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.retryLoad();
    });
    rerender({ eventId: 'event-2' });
    await waitFor(() => expect(mocks.fetchComments).toHaveBeenLastCalledWith('event-2'));

    await act(async () => {
      pendingRetry.resolve({
        comments: [comment('event-1-retry')],
        lastDoc: null,
        hasMore: false,
      });
    });

    expect(result.current.comments.map((item) => item.id)).not.toContain('event-1-retry');
  });

  it('preserves same-event local-only comments when initial load resolves without them', async () => {
    const pendingInitial = createDeferred();
    mocks.fetchComments.mockReturnValueOnce(pendingInitial.promise);

    const { result } = renderHook(() => useComments('event-1'));
    await waitFor(() => expect(mocks.fetchComments).toHaveBeenCalledWith('event-1'));

    act(() => {
      result.current.setComments((prev) => [comment('event-1-local-only'), ...prev]);
    });

    await act(async () => {
      pendingInitial.resolve({
        comments: [comment('event-1-fetched')],
        lastDoc: null,
        hasMore: false,
      });
    });

    expect(result.current.comments.map((item) => item.id)).toEqual([
      'event-1-local-only',
      'event-1-fetched',
    ]);
  });

  it('preserves same-event local-only comments when retry load resolves without them', async () => {
    const pendingRetry = createDeferred();
    mocks.fetchComments
      .mockResolvedValueOnce({
        comments: [comment('event-1-initial')],
        lastDoc: null,
        hasMore: false,
      })
      .mockReturnValueOnce(pendingRetry.promise);

    const { result } = renderHook(() => useComments('event-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.retryLoad();
      result.current.setComments((prev) => [comment('event-1-local-only'), ...prev]);
    });

    await act(async () => {
      pendingRetry.resolve({
        comments: [comment('event-1-initial')],
        lastDoc: null,
        hasMore: false,
      });
    });

    expect(result.current.comments.map((item) => item.id)).toEqual([
      'event-1-local-only',
      'event-1-initial',
    ]);
  });
});
