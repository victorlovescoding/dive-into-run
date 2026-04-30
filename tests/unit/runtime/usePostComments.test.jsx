import { createElement, useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act, waitFor } from '@testing-library/react';
import usePostComments from '@/runtime/hooks/usePostComments';
import { installIntersectionObserverMock } from '../../_helpers/runtime-hook-test-helpers';
import { createMockTransaction, createPostCommentRaw, createFirestoreDoc, createPostCommentsParams, createPostDetailFixture, createUserFixture } from '../../_helpers/post-comments-fixtures';
import { createSubmitEvent, createChangeEvent } from '../../_helpers/use-post-comments-test-helpers';

const TOAST_PROVIDER_MODULE = vi.hoisted(() => '@/runtime/providers/ToastProvider');

const {
  docIdQueue,
  batchSet,
  batchCommit,
  mockAddDoc,
  mockCollection,
  mockCollectionGroup,
  mockDoc,
  mockDocumentId,
  mockGetDoc,
  mockGetDocs,
  mockIncrement,
  mockLimit,
  mockOnSnapshot,
  mockOrderBy,
  mockQuery,
  mockRunTransaction,
  mockServerTimestamp,
  mockStartAfter,
  mockUpdateDoc,
  mockWhere,
  mockWriteBatch,
  mockSearchParams,
  mockSearchParamsGet,
  mockCreateFirestoreTimestamp,
  mockShowToast,
} = vi.hoisted(() => ({
  docIdQueue: /** @type {string[]} */ ([]),
  batchSet: vi.fn(),
  batchCommit: vi.fn(async () => undefined),
  mockAddDoc: vi.fn(async () => ({ id: 'notification-1' })),
  mockCollection: vi.fn((_db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
  mockCollectionGroup: vi.fn((_db, name) => ({ type: 'collectionGroup', path: name })),
  mockDoc: vi.fn((base, ...segments) => {
    if (base?.type === 'collection' && segments.length === 0) {
      const id = docIdQueue.shift() ?? 'generated-doc';
      return { type: 'doc', path: `${base.path}/${id}`, id };
    }
    return {
      type: 'doc',
      path: base?.type === 'collection' ? [base.path, ...segments].join('/') : segments.join('/'),
      id: String(segments.at(-1) ?? ''),
    };
  }),
  mockDocumentId: vi.fn(() => '__name__'),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockIncrement: vi.fn((value) => ({ __op: 'increment', value })),
  mockLimit: vi.fn((count) => ({ type: 'limit', count })),
  mockOnSnapshot: vi.fn(),
  mockOrderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
  mockQuery: vi.fn((ref, ...constraints) => ({ type: 'query', path: ref?.path, constraints })),
  mockRunTransaction: vi.fn(),
  mockServerTimestamp: vi.fn(() => ({ __ts: 'serverTimestamp' })),
  mockStartAfter: vi.fn((...args) => ({ type: 'startAfter', args })),
  mockUpdateDoc: vi.fn(async () => undefined),
  mockWhere: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
  mockWriteBatch: vi.fn(() => ({ set: batchSet, commit: batchCommit })),
  mockSearchParams: { get: vi.fn() },
  mockSearchParamsGet: vi.fn(),
  mockCreateFirestoreTimestamp: vi.fn((date) => ({ __ts: date.toISOString() })),
  mockShowToast: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  addDoc: mockAddDoc,
  collection: mockCollection,
  collectionGroup: mockCollectionGroup,
  doc: mockDoc,
  documentId: mockDocumentId,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  increment: mockIncrement,
  limit: mockLimit,
  onSnapshot: mockOnSnapshot,
  orderBy: mockOrderBy,
  query: mockQuery,
  runTransaction: mockRunTransaction,
  serverTimestamp: mockServerTimestamp,
  startAfter: mockStartAfter,
  updateDoc: mockUpdateDoc,
  where: mockWhere,
  writeBatch: mockWriteBatch,
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => mockSearchParams }));
vi.mock('@/config/client/firebase-timestamp', () => ({ createFirestoreTimestamp: mockCreateFirestoreTimestamp }));
vi.mock(TOAST_PROVIDER_MODULE, () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

/** @type {ReturnType<typeof installIntersectionObserverMock> | null} */
let observer = null;

/**
 * @returns {{ wrapper: (props: { children: import('react').ReactNode }) => import('react').ReactElement, showToast: import('vitest').Mock }}
 *   wrapper 與 toast mock。
 */
function createToastWrapper() {
  return {
    showToast: mockShowToast,
    wrapper: ({ children }) => /** @type {import('react').ReactElement} */ (children),
  };
}

/**
 * 以真實 DOM sentinel 掛載 usePostComments。
 * @param {Parameters<typeof usePostComments>[0]} params - hook props。
 * @returns {{ getCurrent: () => ReturnType<typeof usePostComments> | null, showToast: import('vitest').Mock, unmount: () => void }}
 *   目前 hook 值與 unmount。
 */
function renderPostCommentsWithSentinel(params) {
  /** @type {ReturnType<typeof usePostComments> | null} */
  let latestValue = null;

  /**
   * @param {{ targetRef: import('react').RefObject<HTMLDivElement | null> }} props - sentinel ref。
   * @returns {import('react').ReactElement} sentinel element。
   */
  function SentinelBinder({ targetRef }) {
    return createElement('div', { ref: targetRef });
  }

  /**
   * @returns {import('react').ReactElement} probe element。
   */
  function Probe() {
    const hookValue = usePostComments(params);
    useEffect(() => {
      latestValue = hookValue;
    }, [hookValue]);
    return createElement(SentinelBinder, { targetRef: hookValue.bottomRef });
  }

  const view = render(createElement(Probe));
  return { getCurrent: () => latestValue, showToast: mockShowToast, unmount: view.unmount };
}

describe('usePostComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowToast.mockReset();
    docIdQueue.length = 0;
    mockSearchParams.get = mockSearchParamsGet;
    mockSearchParamsGet.mockReturnValue(null);
  });

  afterEach(() => {
    observer?.restore();
    observer = null;
    vi.useRealTimers();
  });

  it('hydrates initial comments, loads more through IntersectionObserver, and disconnects on unmount', async () => {
    observer = installIntersectionObserverMock();
    const context = createPostCommentsParams();
    const firstPageLast = createPostCommentRaw({ id: 'c2', authorUid: 'u2' });
    const view = renderPostCommentsWithSentinel(context.params);

    act(() => {
      view.getCurrent()?.setInitialComments({ comments: [createPostCommentRaw({ id: 'c1', authorUid: 'me-uid' }), firstPageLast], nextCursor: firstPageLast });
    });

    await waitFor(() => {
      expect(view.getCurrent()?.comments).toHaveLength(2);
    });
    expect(view.getCurrent()?.comments.map((item) => item.isAuthor)).toEqual([true, false]);

    mockGetDocs.mockResolvedValueOnce({
      docs: [createFirestoreDoc('c3', createPostCommentRaw({ id: 'c3', authorUid: 'u3' }))],
    });

    await waitFor(() => {
      expect(observer?.observe).toHaveBeenCalled();
    });

    await act(async () => {
      observer?.trigger();
    });

    await waitFor(() => {
      expect(view.getCurrent()?.comments.map((item) => item.id)).toEqual(['c1', 'c2', 'c3']);
    });

    expect(mockStartAfter).toHaveBeenCalledWith(firstPageLast.createdAt, firstPageLast.id);
    view.unmount();
    expect(observer?.disconnect).toHaveBeenCalled();
  });

  it('adds a comment, prepends fallback hydrated data, and notifies the post author', async () => {
    const context = createPostCommentsParams({
      postDetail: createPostDetailFixture({ authorUid: 'post-author', commentsCount: 1 }),
    });
    const tx = createMockTransaction();
    tx.get.mockResolvedValue({ exists: () => true });
    mockRunTransaction.mockImplementation(async (_db, callback) => callback(tx));
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    docIdQueue.push('comment-new');
    const { wrapper } = createToastWrapper();
    const { result } = renderHook(() => usePostComments(context.params), { wrapper });

    act(() => {
      result.current.handleCommentChange(createChangeEvent('新的留言'));
    });
    await act(async () => {
      await result.current.handleSubmitComment(createSubmitEvent());
    });

    expect(result.current.comments[0]).toMatchObject({
      id: 'comment-new',
      authorUid: 'me-uid',
      comment: '新的留言',
      isAuthor: true,
    });
    expect(result.current.comments[0]?.createdAt).toEqual({ __ts: expect.any(String) });
    expect(context.getPostDetail()?.commentsCount).toBe(2);
    expect(mockCreateFirestoreTimestamp).toHaveBeenCalled();
    expect(mockAddDoc).toHaveBeenCalledWith(
      { type: 'collection', path: 'notifications' },
      expect.objectContaining({
        recipientUid: 'post-author',
        type: 'post_new_comment',
        entityId: 'p1',
        commentId: 'comment-new',
      }),
    );
  });

  it('sends reply-tree notifications to distinct prior commenters except actor and post author', async () => {
    const context = createPostCommentsParams({
      postDetail: createPostDetailFixture({ authorUid: 'post-author' }),
      user: createUserFixture({ uid: 'actor-1', name: 'Actor' }),
    });
    const tx = createMockTransaction();
    tx.get.mockResolvedValue({ exists: () => true });
    mockRunTransaction.mockImplementation(async (_db, callback) => callback(tx));
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        createFirestoreDoc('e1', { authorUid: 'post-author' }),
        createFirestoreDoc('e2', { authorUid: 'actor-1' }),
        createFirestoreDoc('e3', { authorUid: 'reader-1' }),
        createFirestoreDoc('e4', { authorUid: 'reader-2' }),
        createFirestoreDoc('e5', { authorUid: 'reader-1' }),
      ],
    });
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'comment-reply',
      data: () => createPostCommentRaw({ id: 'comment-reply', authorUid: 'actor-1', comment: '回覆' }),
    });
    docIdQueue.push('comment-reply', 'n1', 'n2');
    const { wrapper } = createToastWrapper();
    const { result } = renderHook(() => usePostComments(context.params), { wrapper });

    act(() => {
      result.current.handleCommentChange(createChangeEvent('回覆'));
    });
    await act(async () => {
      await result.current.handleSubmitComment(createSubmitEvent());
    });

    const payloads = batchSet.mock.calls.map((call) => call[1]);
    expect(payloads.map((payload) => payload.recipientUid)).toEqual(['reader-1', 'reader-2']);
    expect(payloads.map((payload) => payload.type)).toEqual([
      'post_comment_reply',
      'post_comment_reply',
    ]);
  });

  it('deletes a comment, clears editing state, and updates comment count', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const context = createPostCommentsParams({
      postDetail: createPostDetailFixture({ commentsCount: 2 }),
    });
    const tx = createMockTransaction();
    tx.get.mockResolvedValue({ exists: () => true });
    mockRunTransaction.mockImplementation(async (_db, callback) => callback(tx));
    const { wrapper } = createToastWrapper();
    const { result } = renderHook(() => usePostComments(context.params), { wrapper });

    act(() => {
      result.current.setInitialComments({
        comments: [
          createPostCommentRaw({ id: 'c1', authorUid: 'me-uid', comment: '我的留言' }),
          createPostCommentRaw({ id: 'c2', authorUid: 'u2', comment: '別人的留言' }),
        ],
        nextCursor: null,
      });
      result.current.handleEditComment('c1');
    });

    await act(async () => {
      await result.current.handleDeleteComment('c1');
    });

    expect(result.current.comments.map((item) => item.id)).toEqual(['c2']);
    expect(result.current.commentEditing).toBeNull();
    expect(result.current.comment).toBe('');
    expect(context.getPostDetail()?.commentsCount).toBe(1);
    expect(context.setOpenMenuPostIdMock).toHaveBeenCalledWith('');
  });

  it('scrolls to highlighted comment and removes highlight after animation end', async () => {
    vi.useFakeTimers();
    mockSearchParamsGet.mockImplementation((key) => (key === 'commentId' ? 'comment-9' : null));
    const element = document.createElement('div');
    element.id = 'comment-9';
    element.scrollIntoView = vi.fn();
    document.body.appendChild(element);
    const { wrapper } = createToastWrapper();
    const { result, unmount } = renderHook(() => usePostComments(createPostCommentsParams().params), { wrapper });

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.highlightedCommentId).toBe('comment-9');
    expect(element.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(element.classList.contains('commentHighlight')).toBe(true);

    act(() => {
      element.dispatchEvent(new Event('animationend'));
    });

    expect(element.classList.contains('commentHighlight')).toBe(false);
    unmount();
    element.remove();
  });
});
