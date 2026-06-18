import { vi } from 'vitest';

export const REPORT_TEST_USERS = Object.freeze({
  reporter: Object.freeze({
    uid: 'uid-reporter',
    name: '檢舉者',
    photoURL: 'https://example.test/reporter.png',
  }),
  targetAuthor: Object.freeze({
    uid: 'uid-author',
    name: '內容作者',
    photoURL: 'https://example.test/author.png',
  }),
});

/**
 * 建立 report dialog 測試用 Firebase Auth/currentUser double。
 * @param {object} [options] - 使用者選項。
 * @param {boolean} [options.authenticated] - 是否提供 currentUser。
 * @param {string} [options.token] - getIdToken 回傳的 ID token。
 * @returns {{ auth: { currentUser: { uid: string, getIdToken: import('vitest').Mock } | null }, currentUser: { uid: string, getIdToken: import('vitest').Mock } | null }}
 *   Auth 與 currentUser 測試 double。
 */
export function createReportAuthMock({
  authenticated = true,
  token = 'firebase-id-token',
} = {}) {
  const currentUser = authenticated
    ? {
      uid: REPORT_TEST_USERS.reporter.uid,
      getIdToken: vi.fn().mockResolvedValue(token),
    }
    : null;

  return {
    auth: { currentUser },
    currentUser,
  };
}

/**
 * 建立 Phase 1 post target fixture。
 * @param {object} [overrides] - 覆寫欄位。
 * @returns {{ targetType: 'post', target: { postId: string }, preview: string, sourcePath: string, authorUid: string }}
 *   Post report target。
 */
export function createReportPostTarget(overrides = {}) {
  return {
    targetType: 'post',
    target: { postId: 'post-report-1' },
    preview: '這是一篇需要被檢舉流程確認的文章預覽。',
    sourcePath: '/posts/post-report-1',
    authorUid: REPORT_TEST_USERS.targetAuthor.uid,
    ...overrides,
  };
}

/**
 * 建立 Phase 1 post comment target fixture。
 * @param {object} [overrides] - 覆寫欄位。
 * @returns {{ targetType: 'postComment', target: { postId: string, commentId: string }, preview: string, sourcePath: string, authorUid: string }}
 *   Post comment report target。
 */
export function createReportPostCommentTarget(overrides = {}) {
  return {
    targetType: 'postComment',
    target: { postId: 'post-report-1', commentId: 'comment-report-1' },
    preview: '這是一則需要被檢舉流程確認的留言預覽。',
    sourcePath: '/posts/post-report-1?commentId=comment-report-1',
    authorUid: REPORT_TEST_USERS.targetAuthor.uid,
    ...overrides,
  };
}
