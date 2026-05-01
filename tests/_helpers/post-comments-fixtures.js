import { vi } from 'vitest';
import { createFirestoreDocSnapshot } from './factories';

/**
 * @typedef {Parameters<typeof import('@/runtime/hooks/usePostComments').default>[0]} PostCommentsParams
 */

/**
 * 共用 fixtures / helpers for usePostComments hook unit tests。
 * 收斂 firestore mock 樣板與 comment payload，避免測試檔超 300 行。
 */

/**
 * @typedef {object} PostCommentRaw
 * @property {string} id - 留言 ID。
 * @property {string} authorUid - 留言者 UID。
 * @property {string} [authorName] - 留言者顯示名稱。
 * @property {string} [authorImgURL] - 留言者大頭貼。
 * @property {string} comment - 留言文字內容。
 * @property {object} [createdAt] - 建立時間 timestamp 替身。
 */

/**
 * 建立單筆原始留言（hook 收到的 raw shape）。
 * @param {Partial<PostCommentRaw>} [overrides] - 要覆寫的欄位。
 * @returns {PostCommentRaw} 留言 fixture。
 */
export function createPostCommentRaw(overrides = {}) {
  return {
    id: 'c1',
    authorUid: 'u1',
    authorName: 'Alice',
    authorImgURL: '',
    comment: 'first comment',
    createdAt: { __ts: 'createdAt' },
    ...overrides,
  };
}

/**
 * 建立 firestore document snapshot（給 getDocs / getDoc mock 用）。
 * @param {string} id - 文件 ID。
 * @param {object} data - 文件資料。
 * @returns {{ id: string, exists: () => boolean, data: () => object, ref: object }} snapshot。
 */
export function createFirestoreDoc(id, data) {
  return createFirestoreDocSnapshot(id, data, { path: `posts/p1/comments/${id}` });
}

/**
 * 建立模擬 postDetail（供 hook 流程使用）。
 * @param {Partial<{ id: string, authorUid: string, title: string, commentsCount: number }>} [overrides] - 要覆寫的欄位。
 * @returns {{ id: string, authorUid: string, title: string, commentsCount: number }} postDetail。
 */
export function createPostDetailFixture(overrides = {}) {
  return {
    id: 'p1',
    authorUid: 'author-uid',
    title: 'My Post',
    commentsCount: 1,
    ...overrides,
  };
}

/**
 * 建立模擬 user。
 * @param {Partial<{ uid: string, name: string, photoURL: string }>} [overrides] - 要覆寫的欄位。
 * @returns {{ uid: string, name: string, photoURL: string }} user。
 */
export function createUserFixture(overrides = {}) {
  return {
    uid: 'me-uid',
    name: 'Me',
    photoURL: '',
    ...overrides,
  };
}

/**
 * 將 createMockTransaction 結果繞回 runTransaction。
 * @returns {{ get: import('vitest').Mock, set: import('vitest').Mock, update: import('vitest').Mock, delete: import('vitest').Mock }} 假 transaction。
 */
export function createMockTransaction() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

/**
 * @typedef {object} CreatePostCommentsParamsOptions
 * @property {string} [postId] - 文章 ID。
 * @property {PostCommentsParams['user']} [user] - 覆寫登入使用者。
 * @property {PostCommentsParams['postDetail']} [postDetail] - 覆寫文章詳情。
 */

/**
 * @typedef {object} PostCommentsTestContext
 * @property {PostCommentsParams} params - 傳給 hook 的參數。
 * @property {import('vitest').Mock} setOpenMenuPostIdMock - menu setter mock。
 * @property {import('vitest').Mock} setPostDetailMock - postDetail setter mock。
 * @property {() => PostCommentsParams['postDetail']} getPostDetail - 取得目前 postDetail state。
 */

/**
 * 建立 hook 所需參數，並保留可檢查的 in-memory postDetail state。
 * @param {CreatePostCommentsParamsOptions} [options] - 覆寫設定。
 * @returns {PostCommentsTestContext} 測試上下文。
 */
export function createPostCommentsParams(options = {}) {
  const postDetailState = {
    current:
      options.postDetail === undefined
        ? createPostDetailFixture()
        : /** @type {PostCommentsParams['postDetail']} */ (options.postDetail),
  };

  const setPostDetailMock = vi.fn(
    /**
     * @param {Parameters<PostCommentsParams['setPostDetail']>[0]} nextPostDetail - 下一個 postDetail 或 updater。
     */
    (nextPostDetail) => {
      postDetailState.current =
        typeof nextPostDetail === 'function'
          ? nextPostDetail(postDetailState.current)
          : nextPostDetail;
    },
  );
  const setOpenMenuPostIdMock = vi.fn();

  /** @type {PostCommentsParams} */
  const params = {
    postId: options.postId ?? 'p1',
    user: options.user === undefined ? createUserFixture() : options.user,
    postDetail: postDetailState.current,
    setPostDetail: /** @type {PostCommentsParams['setPostDetail']} */ (setPostDetailMock),
    setOpenMenuPostId: /** @type {PostCommentsParams['setOpenMenuPostId']} */ (
      setOpenMenuPostIdMock
    ),
  };

  return {
    params,
    setOpenMenuPostIdMock,
    setPostDetailMock,
    getPostDetail: () => postDetailState.current,
  };
}
