import { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, render, act, waitFor } from '@testing-library/react';
import { installIntersectionObserverMock } from '../../_helpers/runtime-hook-test-helpers';

const { mockDoc, mockCollection, mockQuery, mockOrderBy, mockLimit, mockStartAfter, mockGetDocs } =
  vi.hoisted(() => ({
    mockDoc: vi.fn((_db, ...segments) => ({
      type: 'doc',
      path: segments.join('/'),
      id: String(segments.at(-1) ?? ''),
    })),
    mockCollection: vi.fn((_db, ...segments) => ({
      type: 'collection',
      path: segments.join('/'),
    })),
    mockQuery: vi.fn((collectionRef, ...constraints) => ({
      type: 'query',
      path: collectionRef?.path,
      constraints,
    })),
    mockOrderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
    mockLimit: vi.fn((count) => ({ type: 'limit', count })),
    mockStartAfter: vi.fn((cursor) => ({ type: 'startAfter', cursor })),
    mockGetDocs: vi.fn(),
  }));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  collection: mockCollection,
  query: mockQuery,
  orderBy: mockOrderBy,
  limit: mockLimit,
  startAfter: mockStartAfter,
  getDocs: mockGetDocs,
  Timestamp: {
    now: vi.fn(() => ({ toMillis: () => 0 })),
    fromDate: vi.fn((date) => ({ toDate: () => date })),
  },
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));

/**
 * @typedef {object} CommentDocData
 * @property {string} authorUid - 留言者 UID。
 * @property {string} authorName - 留言者名稱。
 * @property {string} authorPhotoURL - 留言者大頭貼。
 * @property {string} content - 留言內容。
 * @property {{ toMillis: () => number }} createdAt - 建立時間。
 * @property {null} updatedAt - 最後更新時間。
 * @property {boolean} isEdited - 是否曾編輯。
 */

/**
 * @typedef {object} CommentSnapshot
 * @property {string} id - 留言 ID。
 * @property {() => CommentDocData} data - 取得 doc data。
 */

/**
 * 建立留言 snapshot。
 * @param {string} id - 留言 ID。
 * @param {Partial<CommentDocData>} [overrides] - 部分覆寫欄位。
 * @returns {CommentSnapshot} 模擬 snapshot。
 */
function createCommentDoc(id, overrides = {}) {
  /** @type {CommentDocData} */
  const data = {
    authorUid: 'u1',
    authorName: 'Author',
    authorPhotoURL: '',
    content: 'msg',
    createdAt: { toMillis: () => 1 },
    updatedAt: null,
    isEdited: false,
    .../** @type {CommentDocData} */ (overrides),
  };
  return {
    id,
    data: () => data,
  };
}

/**
 * 動態載入 hook，避免測試間 module cache 汙染。
 * @returns {Promise<typeof import('@/runtime/hooks/useComments').default>} hook。
 */
async function loadHook() {
  return (await import('@/runtime/hooks/useComments')).default;
}

/**
 * 以真實 DOM sentinel 掛載 hook，讓 IntersectionObserver effect 可以正常 observe。
 * @param {Awaited<ReturnType<typeof loadHook>>} useComments - 目標 hook。
 * @param {string} eventId - 活動 ID。
 * @returns {{ getCurrent: () => ReturnType<Awaited<ReturnType<typeof loadHook>>> | null, unmount: () => void }}
 *   讀取目前 hook state 的 getter 與 unmount。
 */
function renderWithSentinel(useComments, eventId) {
  /** @type {ReturnType<Awaited<ReturnType<typeof loadHook>>> | null} */
  let latestValue = null;

  /**
   * 把本地 DOM node 綁到 hook 提供的 sentinel ref。
   * @param {{ targetRef: import('react').RefObject<HTMLDivElement | null> }} props - sentinel ref。
   * @returns {import('react').ReactElement} sentinel 元素。
   */
  function SentinelBinder({ targetRef }) {
    return <div ref={targetRef} />;
  }

  /**
   * 把 hook state 綁到真實 DOM sentinel。
   * @returns {import('react').ReactElement} sentinel 元素。
   */
  function Probe() {
    const hookValue = useComments(eventId);
    useEffect(() => {
      latestValue = hookValue;
    }, [hookValue]);
    return <SentinelBinder targetRef={hookValue.sentinelRef} />;
  }

  const view = render(<Probe />);
  return { getCurrent: () => latestValue, unmount: view.unmount };
}

/** @type {ReturnType<typeof installIntersectionObserverMock> | null} */
let observerMock = null;

describe('useComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    observerMock?.restore();
    observerMock = null;
  });

  it('loads initial comments and stops loading when fetch resolves', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        createCommentDoc('c1', { content: 'first' }),
        createCommentDoc('c2', { content: 'second' }),
      ],
    });

    const useComments = await loadHook();
    const { result } = renderHook(() => useComments('event-1'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.comments).toHaveLength(2);
    });

    expect(result.current.comments.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.loadError).toBeNull();
    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'events', 'event-1', 'comments');
    expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(mockLimit).toHaveBeenCalledWith(15);
  });

  it('returns empty list and hasMore=false when fetch yields no docs', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    const useComments = await loadHook();
    const { result } = renderHook(() => useComments('event-empty'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.comments).toEqual([]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.loadError).toBeNull();
  });

  it('sets loadError when initial fetch rejects', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('Firestore down'));

    const useComments = await loadHook();
    const { result } = renderHook(() => useComments('event-err'));

    await waitFor(() => {
      expect(result.current.loadError).toBe('載入留言失敗');
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.comments).toEqual([]);
  });

  it('appends next page via IntersectionObserver and uses startAfter cursor', async () => {
    observerMock = installIntersectionObserverMock();

    const firstPageLast = createCommentDoc('c2', { content: 'page1-last' });
    mockGetDocs.mockResolvedValueOnce({
      docs: [createCommentDoc('c1', { content: 'page1-first' }), firstPageLast],
    });

    const useComments = await loadHook();
    const view = renderWithSentinel(useComments, 'event-page');

    await waitFor(() => {
      expect(view.getCurrent()?.comments).toHaveLength(2);
    });

    await waitFor(() => {
      expect(observerMock?.observe).toHaveBeenCalled();
    });

    mockGetDocs.mockResolvedValueOnce({
      docs: [createCommentDoc('c3', { content: 'page2-first' })],
    });

    await act(async () => {
      observerMock?.trigger();
    });

    await waitFor(() => {
      expect(view.getCurrent()?.comments).toHaveLength(3);
    });

    expect(mockStartAfter).toHaveBeenCalledWith(firstPageLast);
    expect(view.getCurrent()?.comments.map((comment) => comment.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('disconnects IntersectionObserver on unmount', async () => {
    observerMock = installIntersectionObserverMock();

    mockGetDocs.mockResolvedValueOnce({
      docs: [createCommentDoc('c1', { content: 'only' })],
    });

    const useComments = await loadHook();
    const view = renderWithSentinel(useComments, 'event-unmount');

    await waitFor(() => {
      expect(view.getCurrent()?.comments).toHaveLength(1);
    });

    await waitFor(() => {
      expect(observerMock?.observe).toHaveBeenCalled();
    });

    view.unmount();

    expect(observerMock?.disconnect).toHaveBeenCalled();
  });

  it('retryLoad re-fetches and clears loadError on success', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('first attempt fails'));

    const useComments = await loadHook();
    const { result } = renderHook(() => useComments('event-retry'));

    await waitFor(() => {
      expect(result.current.loadError).toBe('載入留言失敗');
    });

    mockGetDocs.mockResolvedValueOnce({
      docs: [createCommentDoc('c1', { content: 'after retry' })],
    });

    act(() => {
      result.current.retryLoad();
    });

    await waitFor(() => {
      expect(result.current.comments.map((c) => c.id)).toEqual(['c1']);
    });

    expect(result.current.loadError).toBeNull();
  });
});
