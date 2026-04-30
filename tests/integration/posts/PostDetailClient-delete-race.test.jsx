import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
// Hoisted shared state (available inside vi.mock factories)
// ---------------------------------------------------------------------------
const { mockShowToast, mockPush, mockReplace, mockAuthContext } = vi.hoisted(() => {
  const { createContext } = require('react');
  return {
    mockShowToast: vi.fn(),
    mockPush: vi.fn(),
    mockReplace: vi.fn(),
    mockAuthContext: createContext({
      user: { uid: 'user-1', name: '小明', photoURL: '/avatar.jpg' },
    }),
  };
});

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/runtime/providers/AuthProvider', () => ({
  AuthContext: mockAuthContext,
}));

vi.mock('@/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
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
  commentsCount: 0,
  isAuthor: true,
};

/**
 * 建立 Firestore document snapshot stub。
 * @param {string} id - document ID。
 * @param {object | null} data - document data，null 表示不存在。
 * @returns {object} Firestore-like document snapshot。
 */
function createDocSnapshot(id, data) {
  return {
    id,
    ref: { id, path: `mock/${id}` },
    exists: () => data !== null,
    data: () => data,
  };
}

/**
 * 設定刪除流程需要的 Firestore SDK 邊界 stub。
 * @param {{ deletePostExists?: boolean, batchError?: Error | null }} [options] - 刪除情境。
 * @returns {{ batch: object }} 可供 assertion 使用的 SDK spies。
 */
function setupFirestoreMocks({ deletePostExists = true, batchError = null } = {}) {
  let postReadCount = 0;
  const batch = {
    set: vi.fn(),
    delete: vi.fn(),
    commit: batchError ? vi.fn().mockRejectedValue(batchError) : vi.fn().mockResolvedValue(undefined),
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
      return { id: 'generated-doc', path: `${base.path}/generated-doc` };
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
  firestoreMocks.runTransaction.mockImplementation(async (_db, callback) =>
    callback({ get: vi.fn(), set: vi.fn(), update: vi.fn(), delete: vi.fn() }),
  );
  firestoreMocks.writeBatch.mockReturnValue(batch);
  firestoreMocks.getDoc.mockImplementation(async (ref) => {
    if (ref.path === 'posts/post-1') {
      postReadCount += 1;
      return createDocSnapshot(
        'post-1',
        postReadCount === 1 || deletePostExists ? mockPost : null,
      );
    }
    if (ref.path === 'posts/post-1/likes/user-1') return createDocSnapshot('user-1', null);
    return createDocSnapshot(String(ref.id), null);
  });
  firestoreMocks.getDocs.mockResolvedValue({ docs: [], size: 0 });

  return { batch };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PostDetailClient delete race condition', () => {
  /** @type {ReturnType<typeof vi.spyOn>} */
  let consoleErrorSpy;
  /** @type {ReturnType<typeof vi.spyOn>} */
  let consoleWarnSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    setupFirestoreMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  /**
   * 開啟 owner menu 並按下「刪除」。
   * @param {ReturnType<typeof userEvent.setup>} user - userEvent 實例。
   */
  async function clickDelete(user) {
    await screen.findByText('晨跑日記');
    const moreButton = screen.getByRole('button', { name: '更多選項' });
    await user.click(moreButton);
    const deleteButton = await screen.findByRole('menuitem', { name: '刪除' });
    await user.click(deleteButton);
  }

  it('race path：deletePost 拋「文章不存在」時顯示紅卡片、不 toast、不 navigate', async () => {
    setupFirestoreMocks({ deletePostExists: false });

    const user = userEvent.setup();
    render(<PostDetailClient postId="post-1" />);
    await clickDelete(user);

    await waitFor(() => {
      expect(screen.getByText('找不到這篇文章（可能已被刪除）')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(mockShowToast).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    // race 是預期內的情境，不該觸發 console.error（否則 Next.js dev overlay 會誤報）
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    // 應該以 warn 級別留 trace，方便未來 telemetry / debug
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('already deleted by another session'),
    );
  });

  it('genuine error：deletePost 拋其他錯誤時 toast「刪除文章失敗」、不顯示紅卡片', async () => {
    setupFirestoreMocks({ batchError: new Error('Firestore batch failed') });

    const user = userEvent.setup();
    render(<PostDetailClient postId="post-1" />);
    await clickDelete(user);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('刪除文章失敗，請稍後再試', 'error');
    });
    expect(screen.queryByText('找不到這篇文章（可能已被刪除）')).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    // 真正的錯誤 (非 race) 仍該觸發 console.error，便於 debug
    expect(consoleErrorSpy).toHaveBeenCalledWith('Delete post error:', expect.any(Error));
  });

  it('happy path：deletePost 成功時 navigate 到 /posts?toast=文章已刪除', async () => {
    const { batch } = setupFirestoreMocks();

    const user = userEvent.setup();
    render(<PostDetailClient postId="post-1" />);
    await clickDelete(user);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/posts?toast=文章已刪除');
    });
    expect(batch.commit).toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalledWith(expect.stringContaining('失敗'), 'error');
  });
});
