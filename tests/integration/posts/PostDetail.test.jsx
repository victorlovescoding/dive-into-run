import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
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
// Hoisted shared state (available inside vi.mock factories)
// ---------------------------------------------------------------------------
const { mockPush, mockReplace } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/config/client/firebase-client', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
  limit: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: vi.fn(),
  increment: vi.fn((value) => ({ __type: 'increment', value })),
  collectionGroup: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
  startAfter: vi.fn(),
  documentId: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
    now: vi.fn(() => ({ toDate: () => new Date('2026-04-15T08:00:00Z') })),
  },
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: (props) => <img {...props} />,
}));

// ---------------------------------------------------------------------------
// Imports (after vi.mock — Vitest hoists mocks above these)
// ---------------------------------------------------------------------------
import PostDetailClient from '@/app/posts/[id]/PostDetailClient';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { ToastContext } from '@/runtime/providers/ToastProvider';
import {
  createFirestoreDocSnapshot as createDocSnapshot,
  createFirestoreQuerySnapshot as createQuerySnapshot,
} from '../../_helpers/factories';
import { renderWithAuthToast } from '../../_helpers/provider-test-helpers';

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
// Test fixtures
// ---------------------------------------------------------------------------
const mockPost = {
  id: 'post-1',
  title: '晨跑日記',
  content: '今天跑了十公里',
  authorUid: 'user-1',
  authorName: '小明',
  authorImgURL: '/avatar.jpg',
  postAt: { toDate: () => new Date('2026-04-15T06:00:00Z') },
  likesCount: 5,
  commentsCount: 2,
};

const mockComments = [
  {
    id: 'comment-1',
    authorUid: 'user-2',
    authorName: '小華',
    authorImgURL: '/avatar2.jpg',
    comment: '跑得好！',
    createdAt: { toDate: () => new Date('2026-04-15T07:00:00Z') },
  },
];

const mockUser = {
  uid: 'user-1',
  name: '小明',
  email: null,
  photoURL: '/avatar.jpg',
  bio: null,
  getIdToken: async () => '',
};

/**
 * 使用真實 AuthContext/ToastContext provider value 渲染文章詳情。
 * @returns {ReturnType<typeof renderWithAuthToast>} render 結果與 context spies。
 */
function renderPostDetail() {
  return renderWithAuthToast(<PostDetailClient postId="post-1" />, {
    authContext: AuthContext,
    toastContext: ToastContext,
    auth: { user: mockUser },
  });
}

/**
 * 設定 S1 posts 測試共用的 Firestore SDK 邊界 stub。
 * @returns {{ tx: object, batch: object }} 可供 assertion 使用的 SDK spies。
 */
function setupFirestoreMocks() {
  const tx = {
    get: vi.fn(async (ref) => {
      if (ref.path === 'posts/post-1/likes/user-1') return createDocSnapshot('user-1', null);
      return createDocSnapshot('post-1', mockPost);
    }),
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
      return { id: 'new-comment', path: `${base.path}/new-comment` };
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
  firestoreMocks.addDoc.mockResolvedValue({ id: 'notification-1' });
  firestoreMocks.updateDoc.mockResolvedValue(undefined);
  firestoreMocks.runTransaction.mockImplementation(async (_db, callback) => callback(tx));
  firestoreMocks.writeBatch.mockReturnValue(batch);
  firestoreMocks.getDoc.mockImplementation(async (ref) => {
    if (ref.path === 'posts/post-1/likes/user-1') return createDocSnapshot('user-1', null);
    if (ref.path === 'posts/post-1/comments/new-comment') {
      return createDocSnapshot('new-comment', {
        authorUid: 'user-1',
        authorName: '小明',
        comment: '好棒',
        createdAt: { toDate: () => new Date('2026-04-15T08:00:00Z') },
      });
    }
    return createDocSnapshot('post-1', mockPost);
  });
  firestoreMocks.getDocs.mockImplementation(async (ref) => {
    if (ref.path === 'posts/post-1/comments') {
      return createQuerySnapshot(
        mockComments.map((comment) => createDocSnapshot(comment.id, comment)),
      );
    }
    return createQuerySnapshot([]);
  });

  return { tx, batch };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PostDetailClient', () => {
  /** @type {{ tx: object, batch: object }} */
  let sdkSpies;

  beforeEach(() => {
    vi.clearAllMocks();
    sdkSpies = setupFirestoreMocks();
  });

  it('文章區域以 PostCard 呈現（article 語義元素）', async () => {
    renderPostDetail();
    const articles = await screen.findAllByRole('article');
    expect(articles[0]).toBeInTheDocument();
  });

  it('顯示文章標題和完整內容', async () => {
    renderPostDetail();
    expect(await screen.findByText('晨跑日記')).toBeInTheDocument();
    expect(screen.getByText('今天跑了十公里')).toBeInTheDocument();
  });

  it('留言以 CommentCard 呈現（每則留言各自為 article 語義元素）', async () => {
    renderPostDetail();
    await screen.findByText('晨跑日記');
    // 文章本身 1 個 article + 留言 1 個 article = 至少 2 個
    const articles = screen.getAllByRole('article');
    expect(articles.length).toBeGreaterThanOrEqual(2);
  });

  it('顯示留言列表', async () => {
    renderPostDetail();
    expect(await screen.findByText('跑得好！')).toBeInTheDocument();
  });

  it('按讚按鈕可點擊', async () => {
    const user = userEvent.setup();
    renderPostDetail();
    await screen.findByText('晨跑日記');
    const likeButton = screen.getByRole('button', { name: '按讚' });
    await user.click(likeButton);
    expect(firestoreMocks.runTransaction).toHaveBeenCalled();
    expect(sdkSpies.tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'posts/post-1/likes/user-1' }),
      expect.objectContaining({ uid: 'user-1', postId: 'post-1' }),
    );
  });

  it('留言輸入後可送出', async () => {
    const user = userEvent.setup();
    renderPostDetail();
    await screen.findByText('晨跑日記');
    const input = screen.getByPlaceholderText(/留言/);
    await user.type(input, '好棒');
    await user.click(screen.getByRole('button', { name: /送出/ }));
    expect(sdkSpies.tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'posts/post-1/comments/new-comment' }),
      expect.objectContaining({ comment: '好棒', authorUid: 'user-1' }),
    );
  });
});
