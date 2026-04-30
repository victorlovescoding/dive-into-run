import { vi } from 'vitest';
import { createMockTransaction } from './post-comments-fixtures';

/**
 * @typedef {object} TestUser
 * @property {string} uid - 使用者 UID。
 * @property {string} name - 顯示名稱。
 * @property {string} photoURL - 大頭貼。
 */

/**
 * @typedef {object} CreateCommentMutationPropsOptions
 * @property {string} [eventId] - 活動 ID。
 * @property {TestUser | null} [user] - 目前使用者。
 * @property {object[]} [initialComments] - 初始留言列表。
 * @property {boolean} [withOnSuccess] - 是否建立 onSuccess mock。
 */

const hoistedBoundaryMocks = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockDoc: vi.fn((parentOrDb, ...segments) => {
    if (segments.length === 0 && parentOrDb?.path) {
      return {
        type: 'doc',
        path: `${parentOrDb.path}/generated-doc`,
        id: 'generated-doc',
      };
    }

    return {
      type: 'doc',
      path: segments.join('/'),
      id: String(segments.at(-1) ?? ''),
    };
  }),
  mockCollection: vi.fn((_db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
  mockQuery: vi.fn((collectionRef, ...constraints) => ({
    type: 'query',
    path: collectionRef?.path,
    constraints,
  })),
  mockOrderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
  mockLimit: vi.fn((count) => ({ type: 'limit', count })),
  mockStartAfter: vi.fn((cursor) => ({ type: 'startAfter', cursor })),
  mockServerTimestamp: vi.fn(() => ({ __sentinel: 'serverTimestamp' })),
  mockRunTransaction: vi.fn(),
  mockWriteBatch: vi.fn(),
  mockTimestampNow: vi.fn(() => ({ __ts: 'now' })),
  mockTimestampFromDate: vi.fn((date) => ({ __ts: 'fromDate', date })),
  mockGetCurrentFirestoreTimestamp: vi.fn(() => ({ __ts: 'current' })),
}));

/**
 * Firestore / Firebase 邊界 mock 集合。
 * @type {{
 *   mockAddDoc: import('vitest').Mock,
 *   mockGetDoc: import('vitest').Mock,
 *   mockGetDocs: import('vitest').Mock,
 *   mockDoc: import('vitest').Mock,
 *   mockCollection: import('vitest').Mock,
 *   mockQuery: import('vitest').Mock,
 *   mockOrderBy: import('vitest').Mock,
 *   mockLimit: import('vitest').Mock,
 *   mockStartAfter: import('vitest').Mock,
 *   mockServerTimestamp: import('vitest').Mock,
 *   mockRunTransaction: import('vitest').Mock,
 *   mockWriteBatch: import('vitest').Mock,
 *   mockTimestampNow: import('vitest').Mock,
 *   mockTimestampFromDate: import('vitest').Mock,
 *   mockGetCurrentFirestoreTimestamp: import('vitest').Mock,
 * }}
 */
export const commentMutationBoundaryMocks = hoistedBoundaryMocks;

vi.mock('firebase/firestore', () => ({
  addDoc: hoistedBoundaryMocks.mockAddDoc,
  getDoc: hoistedBoundaryMocks.mockGetDoc,
  getDocs: hoistedBoundaryMocks.mockGetDocs,
  doc: hoistedBoundaryMocks.mockDoc,
  collection: hoistedBoundaryMocks.mockCollection,
  query: hoistedBoundaryMocks.mockQuery,
  orderBy: hoistedBoundaryMocks.mockOrderBy,
  limit: hoistedBoundaryMocks.mockLimit,
  startAfter: hoistedBoundaryMocks.mockStartAfter,
  serverTimestamp: hoistedBoundaryMocks.mockServerTimestamp,
  runTransaction: hoistedBoundaryMocks.mockRunTransaction,
  writeBatch: hoistedBoundaryMocks.mockWriteBatch,
  Timestamp: {
    now: hoistedBoundaryMocks.mockTimestampNow,
    fromDate: hoistedBoundaryMocks.mockTimestampFromDate,
  },
}));

/**
 * 建立 `useCommentMutations` 測試 props，並保留一份 in-memory 留言狀態。
 * @param {CreateCommentMutationPropsOptions} [overrides] - props 覆寫。
 * @returns {{
 *   eventId: string,
 *   user: TestUser | null,
 *   setComments: import('vitest').Mock,
 *   onSuccess: import('vitest').Mock | undefined,
 *   getComments: () => object[],
 * }} hook props。
 */
export function createCommentMutationProps(overrides = {}) {
  const commentsState = { current: [...(overrides.initialComments ?? [])] };
  const setComments = vi.fn((updater) => {
    commentsState.current =
      typeof updater === 'function' ? updater(commentsState.current) : [...updater];
  });

  return {
    eventId: overrides.eventId ?? 'event-1',
    user:
      'user' in overrides
        ? overrides.user
        : { uid: 'u1', name: 'Alice', photoURL: '' },
    setComments,
    onSuccess: overrides.withOnSuccess ? vi.fn() : undefined,
    getComments: () => commentsState.current,
  };
}

/**
 * 建立成功的 edit transaction mock，並回傳交易物件供後續斷言。
 * @returns {{ get: import('vitest').Mock, set: import('vitest').Mock, update: import('vitest').Mock, delete: import('vitest').Mock }} transaction mock。
 */
export function mockSuccessfulEditTransaction() {
  const tx = createMockTransaction();
  tx.get.mockResolvedValueOnce({ exists: () => true });

  hoistedBoundaryMocks.mockRunTransaction.mockImplementationOnce(async (_db, callback) =>
    callback(tx),
  );

  return tx;
}
