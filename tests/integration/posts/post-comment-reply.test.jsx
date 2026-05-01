import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  documentId,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Polyfills
// ---------------------------------------------------------------------------

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((q) => ({
    matches: false,
    media: q,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ---------------------------------------------------------------------------
// Mocks -- firebase-client (prevent real Firebase init)
// ---------------------------------------------------------------------------

vi.mock('@/config/client/firebase-client', () => ({
  db: {},
  auth: {},
  provider: {},
}));

vi.mock('firebase/firestore', () => ({
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
    now: vi.fn(() => ({ toDate: () => new Date('2026-04-15T08:00:00Z') })),
  },
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
  writeBatch: vi.fn(),
  runTransaction: vi.fn(),
  increment: vi.fn((value) => ({ __type: 'increment', value })),
  collectionGroup: vi.fn(),
  documentId: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
  getFirestore: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  GoogleAuthProvider: vi.fn(() => ({ setCustomParameters: vi.fn() })),
  connectAuthEmulator: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks -- contexts
// ---------------------------------------------------------------------------

vi.mock('@/runtime/providers/AuthProvider', async () => {
  const { createContext } = await import('react');
  return {
    AuthContext: createContext({
      user: {
        uid: 'user1',
        name: 'Test User',
        email: null,
        photoURL: 'http://photo.jpg',
        bio: null,
        getIdToken: async () => '',
      },
      setUser: () => {},
      loading: false,
    }),
    default: ({ children }) => children,
  };
});

const mockShowToast = vi.fn();
vi.mock('@/runtime/providers/ToastProvider', async () => {
  const { createContext } = await import('react');
  return {
    useToast: () => ({ showToast: mockShowToast }),
    ToastContext: createContext({
      toasts: [],
      showToast: () => {},
      removeToast: () => {},
    }),
    default: ({ children }) => children,
  };
});

// ---------------------------------------------------------------------------
// Mocks -- next
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock('next/image', async () => {
  const { createElement } = await import('react');
  return {
    default: ({ fill: _fill, priority: _priority, ...rest }) => createElement('img', rest),
  };
});

// ---------------------------------------------------------------------------
// Mocks -- components
// ---------------------------------------------------------------------------

vi.mock('@/components/ShareButton', () => ({ default: () => <div /> }));
vi.mock('@/components/UserLink', () => ({
  default: ({ name }) => <span>{name}</span>,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import PostDetailClient from '@/app/posts/[id]/PostDetailClient';
import {
  createFirestoreDocSnapshot as createDocSnapshot,
  createFirestoreQuerySnapshot as createQuerySnapshot,
} from '../../_helpers/factories';

const firestoreMocks = {
  ['addDoc']: /** @type {import('vitest').Mock} */ (addDoc),
  ['collection']: /** @type {import('vitest').Mock} */ (collection),
  ['collectionGroup']: /** @type {import('vitest').Mock} */ (collectionGroup),
  ['doc']: /** @type {import('vitest').Mock} */ (doc),
  ['documentId']: /** @type {import('vitest').Mock} */ (documentId),
  ['getDoc']: /** @type {import('vitest').Mock} */ (getDoc),
  ['getDocs']: /** @type {import('vitest').Mock} */ (getDocs),
  ['increment']: /** @type {import('vitest').Mock} */ (increment),
  ['limit']: /** @type {import('vitest').Mock} */ (limit),
  ['orderBy']: /** @type {import('vitest').Mock} */ (orderBy),
  ['query']: /** @type {import('vitest').Mock} */ (query),
  ['runTransaction']: /** @type {import('vitest').Mock} */ (runTransaction),
  ['serverTimestamp']: /** @type {import('vitest').Mock} */ (serverTimestamp),
  ['startAfter']: /** @type {import('vitest').Mock} */ (startAfter),
  ['updateDoc']: /** @type {import('vitest').Mock} */ (updateDoc),
  ['where']: /** @type {import('vitest').Mock} */ (where),
  ['writeBatch']: /** @type {import('vitest').Mock} */ (writeBatch),
  ['timestampFromDate']: /** @type {import('vitest').Mock} */ (Timestamp.fromDate),
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockPost = {
  id: 'post1',
  title: '測試文章',
  content: '內容',
  authorUid: 'author1',
  authorName: 'Author',
  authorImgURL: 'http://author.jpg',
  likesCount: 0,
  commentsCount: 0,
};

const existingComments = [
  { id: 'old-comment-1', authorUid: 'user2', comment: '舊留言' },
  { id: 'old-comment-2', authorUid: 'author1', comment: '作者留言' },
  { id: 'old-comment-3', authorUid: 'user1', comment: '自己的留言' },
];

/**
 * 設定留言通知測試需要的 Firestore SDK 邊界 stub。
 * @returns {{ tx: object, batch: object }} 可供 assertion 使用的 SDK spies。
 */
function setupFirestoreMocks() {
  const tx = {
    get: vi.fn(async () => createDocSnapshot('post1', mockPost)),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const batch = {
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };

  firestoreMocks.collection.mockImplementation((_dbOrRef, ...segments) => ({
    type: 'collection',
    path: segments.join('/'),
  }));
  firestoreMocks.collectionGroup.mockImplementation((_db, groupId) => ({
    type: 'collectionGroup',
    path: groupId,
  }));
  firestoreMocks.doc.mockImplementation((base, ...segments) => {
    if (base?.type === 'collection' && segments.length === 0) {
      return { id: 'comment1', path: `${base.path}/comment1` };
    }
    if (base?.type === 'collection') {
      return { id: String(segments.at(-1)), path: [base.path, ...segments].join('/') };
    }
    return { id: String(segments.at(-1)), path: segments.join('/') };
  });
  firestoreMocks.query.mockImplementation((...parts) => ({
    type: 'query',
    path: parts[0]?.path,
    parts,
  }));
  firestoreMocks.where.mockImplementation((...parts) => ({ type: 'where', parts }));
  firestoreMocks.orderBy.mockImplementation((...parts) => ({ type: 'orderBy', parts }));
  firestoreMocks.limit.mockImplementation((count) => ({ type: 'limit', count }));
  firestoreMocks.startAfter.mockImplementation((...parts) => ({ type: 'startAfter', parts }));
  firestoreMocks.documentId.mockReturnValue('__name__');
  firestoreMocks.addDoc.mockResolvedValue({ id: 'notification1' });
  firestoreMocks.updateDoc.mockResolvedValue(undefined);
  firestoreMocks.runTransaction.mockImplementation(async (_db, callback) => callback(tx));
  firestoreMocks.writeBatch.mockReturnValue(batch);
  firestoreMocks.getDoc.mockImplementation(async (ref) => {
    if (ref.path === 'posts/post1/likes/user1') return createDocSnapshot('user1', null);
    if (ref.path === 'posts/post1/comments/comment1') {
      return createDocSnapshot('comment1', {
        authorUid: 'user1',
        authorName: 'Test User',
        authorImgURL: 'http://photo.jpg',
        comment: '測試留言',
        createdAt: new Date(),
      });
    }
    return createDocSnapshot('post1', mockPost);
  });
  firestoreMocks.getDocs.mockImplementation(async (ref) => {
    if (ref.path === 'posts/post1/comments') {
      return createQuerySnapshot(
        existingComments.map((comment) => createDocSnapshot(comment.id, comment)),
      );
    }
    return createQuerySnapshot([]);
  });

  return { tx, batch };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PostDetailClient — 留言跟帖通知 (notifyPostCommentReply)', () => {
  /** @type {{ tx: object, batch: object }} */
  let sdkSpies;

  beforeEach(() => {
    vi.clearAllMocks();
    sdkSpies = setupFirestoreMocks();
  });

  it('送出留言後建立新留言通知和跟帖通知', async () => {
    const user = userEvent.setup();
    render(<PostDetailClient postId="post1" />);

    // 等文章載入
    await screen.findByText('測試文章');

    // 輸入留言
    const input = screen.getByRole('textbox', { name: '留言' });
    await user.type(input, '測試留言');

    // 送出
    const submitBtn = screen.getByRole('button', { name: '送出' });
    await user.click(submitBtn);

    // 驗證 addComment 的 transaction 寫入新留言
    await waitFor(() => {
      expect(sdkSpies.tx.set).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'posts/post1/comments/comment1' }),
        expect.objectContaining({ comment: '測試留言', authorUid: 'user1' }),
      );
    });

    // 驗證 notifyPostNewComment 的 SDK 邊界效果（留言者 user1 !== 文章作者 author1）
    await waitFor(() => {
      expect(firestoreMocks.addDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'notifications' }),
        expect.objectContaining({
          recipientUid: 'author1',
          type: 'post_new_comment',
          entityType: 'post',
          entityId: 'post1',
          entityTitle: '測試文章',
          commentId: 'comment1',
          actorUid: 'user1',
          actorName: 'Test User',
          actorPhotoURL: 'http://photo.jpg',
        }),
      );
    });

    // 驗證 notifyPostCommentReply 的 SDK 邊界效果
    await waitFor(() => {
      expect(sdkSpies.batch.set).toHaveBeenCalled();
    });
  });

  it('notifyPostCommentReply 只通知排除作者與留言者後的跟帖者', async () => {
    const user = userEvent.setup();
    render(<PostDetailClient postId="post1" />);

    // 等文章載入
    await screen.findByText('測試文章');

    // 輸入留言
    const input = screen.getByRole('textbox', { name: '留言' });
    await user.type(input, '測試留言');

    // 送出
    const submitBtn = screen.getByRole('button', { name: '送出' });
    await user.click(submitBtn);

    // 等 addComment transaction 完成
    await waitFor(() => {
      expect(sdkSpies.tx.set).toHaveBeenCalled();
    });

    // 驗證 notifyPostCommentReply 的 batch payload。
    await waitFor(() => {
      expect(sdkSpies.batch.set).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'notifications/comment1' }),
        expect.objectContaining({
          recipientUid: 'user2',
          type: 'post_comment_reply',
          entityType: 'post',
          entityId: 'post1',
          entityTitle: '測試文章',
          commentId: 'comment1',
          actorUid: 'user1',
          actorName: 'Test User',
          actorPhotoURL: 'http://photo.jpg',
        }),
      );
    });
    expect(sdkSpies.batch.set).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ recipientUid: 'author1' }),
    );
    expect(sdkSpies.batch.set).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ recipientUid: 'user1' }),
    );
    expect(sdkSpies.batch.commit).toHaveBeenCalled();
  });
});
