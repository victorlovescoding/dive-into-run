import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  POST_SEARCH_VIEWER_UID,
  createPostSearchPost,
  createPostSearchTimestamp,
  createPostSearchCursor,
  createPostSearchFixtureSet,
} from '../../_helpers/posts-search-fixtures';

const firestoreMocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn((...path) => ({ path })),
  collectionGroup: vi.fn((...path) => ({ path })),
  doc: vi.fn((...path) => ({ path })),
  documentId: vi.fn(() => '__name__'),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  increment: vi.fn((value) => ({ __type: 'increment', value })),
  limit: vi.fn((count) => ({ __type: 'limit', count })),
  orderBy: vi.fn((field, direction) => ({ __type: 'orderBy', field, direction })),
  query: vi.fn((source, ...constraints) => ({ source, constraints })),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
  startAfter: vi.fn((...values) => ({ __type: 'startAfter', values })),
  where: vi.fn((field, op, value) => ({ __type: 'where', field, op, value })),
}));

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('@/config/client/firebase-client', () => ({ db: {} }));

/**
 * @typedef {(params: {
 *   keyword: string,
 *   userUid: string | null,
 *   pageSize: number,
 *   cursor: ReturnType<typeof createPostSearchCursor> | null,
 * }) => Promise<{
 *   keyword: string,
 *   items: Array<{ post: { id: string } }>,
 *   nextCursor: ReturnType<typeof createPostSearchCursor> | null,
 *   hasMore: boolean,
 *   scannedCount: number,
 * }>} SearchPublicActivePostsUseCase
 */

/**
 * Builds a Firestore QueryDocumentSnapshot-like post fixture.
 * @param {Record<string, unknown> & { id: string }} post - Post record.
 * @returns {{ id: string, data: () => Record<string, unknown> }} Snapshot-like doc.
 */
function postSnapshot(post) {
  const { id, ...data } = post;
  return { id, data: () => data };
}

/**
 * Resolves the future search use-case export.
 * @returns {Promise<SearchPublicActivePostsUseCase>} Search use-case.
 */
async function getSearchPublicActivePosts() {
  const postUseCases = await import('@/runtime/client/use-cases/post-use-cases');
  const searchPublicActivePosts = Reflect.get(postUseCases, 'searchPublicActivePosts');
  expect(typeof searchPublicActivePosts).toBe('function');
  return /** @type {SearchPublicActivePostsUseCase} */ (searchPublicActivePosts);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('searchPublicActivePosts candidate scan pagination', () => {
  it('keeps older title hits on the first page ahead of newer content-only hits', async () => {
    const { keyword } = createPostSearchFixtureSet();
    const contentHitNewest = createPostSearchPost({
      id: 'post-search-content-rank-newest',
      title: 'Morning harbor notes',
      content: 'The reef climb started after sunrise.',
      postAt: createPostSearchTimestamp('2026-06-14T12:00:00.000Z'),
    });
    const contentHitSecond = createPostSearchPost({
      id: 'post-search-content-rank-second',
      title: 'Lunch progression notes',
      content: 'A steady reef segment closed the workout.',
      postAt: createPostSearchTimestamp('2026-06-14T11:00:00.000Z'),
    });
    const titleHitOlder = createPostSearchPost({
      id: 'post-search-title-rank-older',
      title: 'Reef evening route',
      content: 'Cooldown without the search term in this body.',
      postAt: createPostSearchTimestamp('2026-06-14T10:00:00.000Z'),
    });
    firestoreMocks.getDocs
      .mockResolvedValueOnce({
        docs: [postSnapshot(contentHitNewest), postSnapshot(contentHitSecond)],
      })
      .mockResolvedValueOnce({
        docs: [postSnapshot(titleHitOlder)],
      });

    const searchPublicActivePosts = await getSearchPublicActivePosts();
    const result = await searchPublicActivePosts({
      keyword,
      userUid: POST_SEARCH_VIEWER_UID,
      pageSize: 2,
      cursor: null,
    });

    expect(result.items.map((item) => item.post.id)).toEqual([
      titleHitOlder.id,
      contentHitNewest.id,
    ]);
    expect(result.nextCursor).toEqual({
      lastPostAt: titleHitOlder.postAt,
      lastPostId: titleHitOlder.id,
      scannedCount: 3,
      resultCount: 2,
      exhausted: false,
    });
    expect(result.hasMore).toBe(true);
  });

  it('keeps scanning candidate pages until public active matches fill the requested page', async () => {
    const { keyword, posts } = createPostSearchFixtureSet();
    firestoreMocks.getDocs
      .mockResolvedValueOnce({
        docs: [
          postSnapshot(posts.softDeleted),
          postSnapshot(posts.titleHitNewest),
        ],
      })
      .mockResolvedValueOnce({
        docs: [
          postSnapshot(posts.accountHidden),
          postSnapshot(posts.contentHit),
        ],
      })
      .mockResolvedValueOnce({
        docs: [],
      });

    const searchPublicActivePosts = await getSearchPublicActivePosts();
    const result = await searchPublicActivePosts({
      keyword,
      userUid: POST_SEARCH_VIEWER_UID,
      pageSize: 2,
      cursor: null,
    });

    expect(firestoreMocks.getDocs).toHaveBeenNthCalledWith(1, expect.any(Object));
    expect(firestoreMocks.getDocs).toHaveBeenLastCalledWith(expect.any(Object));
    expect(firestoreMocks.startAfter).toHaveBeenCalledWith(
      posts.titleHitNewest.postAt,
      posts.titleHitNewest.id,
    );
    expect(firestoreMocks.startAfter).toHaveBeenCalledWith(
      posts.contentHit.postAt,
      posts.contentHit.id,
    );
    expect(result.items.map((item) => item.post.id)).toEqual([
      posts.titleHitNewest.id,
      posts.contentHit.id,
    ]);
    expect(result.hasMore).toBe(false);
    expect(result.scannedCount).toBe(4);
    expect(result.nextCursor).toEqual({
      lastPostAt: posts.contentHit.postAt,
      lastPostId: posts.contentHit.id,
      scannedCount: 4,
      resultCount: 2,
      exhausted: true,
    });
  });

  it('uses the supplied result offset while rebuilding the sorted match window for load more', async () => {
    const { keyword, posts } = createPostSearchFixtureSet();
    const cursor = createPostSearchCursor({
      lastPostAt: posts.titleAndContentHit.postAt,
      lastPostId: posts.titleAndContentHit.id,
      scannedCount: 4,
      resultCount: 2,
      exhausted: false,
    });
    firestoreMocks.getDocs
      .mockResolvedValueOnce({
        docs: [
          postSnapshot(posts.titleHitNewest),
          postSnapshot(posts.titleAndContentHit),
        ],
      })
      .mockResolvedValueOnce({
        docs: [
          postSnapshot(posts.contentHitOlder),
          postSnapshot(posts.authorNameOnly),
        ],
      })
      .mockResolvedValueOnce({
        docs: [],
      });

    const searchPublicActivePosts = await getSearchPublicActivePosts();
    const result = await searchPublicActivePosts({
      keyword,
      userUid: POST_SEARCH_VIEWER_UID,
      pageSize: 2,
      cursor,
    });

    expect(firestoreMocks.getDocs).toHaveBeenNthCalledWith(1, expect.any(Object));
    expect(firestoreMocks.getDocs).toHaveBeenLastCalledWith(expect.any(Object));
    expect(firestoreMocks.startAfter).toHaveBeenNthCalledWith(
      1,
      posts.titleAndContentHit.postAt,
      posts.titleAndContentHit.id,
    );
    expect(firestoreMocks.startAfter).toHaveBeenNthCalledWith(
      2,
      posts.authorNameOnly.postAt,
      posts.authorNameOnly.id,
    );
    expect(result.items.map((item) => item.post.id)).toEqual([posts.contentHitOlder.id]);
    expect(result.hasMore).toBe(false);
    expect(result.scannedCount).toBe(8);
    expect(result.nextCursor).toEqual({
      lastPostAt: posts.authorNameOnly.postAt,
      lastPostId: posts.authorNameOnly.id,
      scannedCount: 8,
      resultCount: 3,
      exhausted: true,
    });
  });

  it('returns an empty exhausted page only after all scanned candidates fail active visibility or keyword matching', async () => {
    const { keyword, posts } = createPostSearchFixtureSet();
    firestoreMocks.getDocs
      .mockResolvedValueOnce({
        docs: [
          postSnapshot(posts.softDeleted),
          postSnapshot(posts.accountHidden),
        ],
      })
      .mockResolvedValueOnce({
        docs: [postSnapshot(posts.authorNameOnly)],
      });

    const searchPublicActivePosts = await getSearchPublicActivePosts();
    const result = await searchPublicActivePosts({
      keyword,
      userUid: null,
      pageSize: 2,
      cursor: null,
    });

    expect(firestoreMocks.getDocs).toHaveBeenNthCalledWith(1, expect.any(Object));
    expect(firestoreMocks.getDocs).toHaveBeenLastCalledWith(expect.any(Object));
    expect(firestoreMocks.startAfter).toHaveBeenCalledWith(
      posts.accountHidden.postAt,
      posts.accountHidden.id,
    );
    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.scannedCount).toBe(3);
    expect(result.nextCursor).toEqual({
      lastPostAt: posts.authorNameOnly.postAt,
      lastPostId: posts.authorNameOnly.id,
      scannedCount: 3,
      resultCount: 0,
      exhausted: true,
    });
  });

  it('dedupes repeated load-more candidates while continuing scans to fill the requested page', async () => {
    const { keyword, posts } = createPostSearchFixtureSet();
    const cursor = createPostSearchCursor({
      lastPostAt: posts.titleHitNewest.postAt,
      lastPostId: posts.titleHitNewest.id,
      scannedCount: 4,
      resultCount: 1,
      exhausted: false,
    });
    firestoreMocks.getDocs
      .mockResolvedValueOnce({
        docs: [
          postSnapshot(posts.titleHitNewest),
          postSnapshot(posts.contentHit),
        ],
      })
      .mockResolvedValueOnce({
        docs: [
          postSnapshot(posts.contentHit),
          postSnapshot(posts.contentHitOlder),
        ],
      })
      .mockResolvedValueOnce({
        docs: [],
      });

    const searchPublicActivePosts = await getSearchPublicActivePosts();
    const result = await searchPublicActivePosts({
      keyword,
      userUid: POST_SEARCH_VIEWER_UID,
      pageSize: 2,
      cursor,
    });

    expect(firestoreMocks.startAfter).toHaveBeenNthCalledWith(
      1,
      posts.contentHit.postAt,
      posts.contentHit.id,
    );
    expect(firestoreMocks.startAfter).toHaveBeenNthCalledWith(
      2,
      posts.contentHitOlder.postAt,
      posts.contentHitOlder.id,
    );
    expect(result.items.map((item) => item.post.id)).toEqual([
      posts.contentHit.id,
      posts.contentHitOlder.id,
    ]);
    expect(result.scannedCount).toBe(8);
    expect(result.nextCursor).toEqual({
      lastPostAt: posts.contentHitOlder.postAt,
      lastPostId: posts.contentHitOlder.id,
      scannedCount: 8,
      resultCount: 3,
      exhausted: true,
    });
    expect(result.hasMore).toBe(false);
  });

  it('does not query again when the supplied load-more cursor is already exhausted', async () => {
    const { keyword, posts } = createPostSearchFixtureSet();
    const exhaustedCursor = createPostSearchCursor({
      lastPostAt: posts.contentHitOlder.postAt,
      lastPostId: posts.contentHitOlder.id,
      scannedCount: 7,
      resultCount: 3,
      exhausted: true,
    });

    const searchPublicActivePosts = await getSearchPublicActivePosts();
    const result = await searchPublicActivePosts({
      keyword,
      userUid: POST_SEARCH_VIEWER_UID,
      pageSize: 2,
      cursor: exhaustedCursor,
    });

    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();
    expect(firestoreMocks.startAfter).not.toHaveBeenCalled();
    expect(result).toEqual({
      keyword,
      items: [],
      nextCursor: exhaustedCursor,
      hasMore: false,
      scannedCount: 7,
    });
  });

  it('returns an empty exhausted load-more page when the result offset reaches all sorted matches', async () => {
    const { keyword, posts } = createPostSearchFixtureSet();
    const cursor = createPostSearchCursor({
      lastPostAt: posts.contentHitOlder.postAt,
      lastPostId: posts.contentHitOlder.id,
      scannedCount: 7,
      resultCount: 3,
      exhausted: false,
    });
    firestoreMocks.getDocs
      .mockResolvedValueOnce({
        docs: [
          postSnapshot(posts.contentHit),
          postSnapshot(posts.contentHitOlder),
        ],
      })
      .mockResolvedValueOnce({
        docs: [],
      });

    const searchPublicActivePosts = await getSearchPublicActivePosts();
    const result = await searchPublicActivePosts({
      keyword,
      userUid: POST_SEARCH_VIEWER_UID,
      pageSize: 2,
      cursor,
    });

    expect(firestoreMocks.startAfter.mock.calls).toEqual([
      [posts.contentHitOlder.postAt, posts.contentHitOlder.id],
    ]);
    expect(firestoreMocks.getDocs.mock.calls).toEqual([[expect.any(Object)], [expect.any(Object)]]);
    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.scannedCount).toBe(9);
    expect(result.nextCursor).toEqual({
      lastPostAt: posts.contentHitOlder.postAt,
      lastPostId: posts.contentHitOlder.id,
      scannedCount: 9,
      resultCount: 3,
      exhausted: true,
    });
  });

  it('propagates initial operational failures instead of returning an empty search page', async () => {
    const { keyword } = createPostSearchFixtureSet();
    const operationalFailure = new Error('candidate scan unavailable');
    firestoreMocks.getDocs.mockRejectedValueOnce(operationalFailure);

    const searchPublicActivePosts = await getSearchPublicActivePosts();

    await expect(
      searchPublicActivePosts({
        keyword,
        userUid: POST_SEARCH_VIEWER_UID,
        pageSize: 2,
        cursor: null,
      }),
    ).rejects.toThrow(operationalFailure);
    expect(firestoreMocks.getDocs).toHaveBeenLastCalledWith(expect.any(Object));
    expect(firestoreMocks.startAfter).not.toHaveBeenCalled();
  });

  it('propagates load-more operational failures while rebuilding the sorted result window', async () => {
    const { keyword, posts } = createPostSearchFixtureSet();
    const cursor = createPostSearchCursor({
      lastPostAt: posts.contentHit.postAt,
      lastPostId: posts.contentHit.id,
      scannedCount: 4,
      resultCount: 2,
      exhausted: false,
    });
    const operationalFailure = new Error('load more candidate scan unavailable');
    firestoreMocks.getDocs.mockRejectedValueOnce(operationalFailure);

    const searchPublicActivePosts = await getSearchPublicActivePosts();

    await expect(
      searchPublicActivePosts({
        keyword,
        userUid: POST_SEARCH_VIEWER_UID,
        pageSize: 2,
        cursor,
      }),
    ).rejects.toThrow(operationalFailure);
    expect(firestoreMocks.startAfter).not.toHaveBeenCalled();
    expect(firestoreMocks.getDocs).toHaveBeenLastCalledWith(expect.any(Object));
  });
});
