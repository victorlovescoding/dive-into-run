import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
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
const { mockShowToast, mockAuthContext } = vi.hoisted(() => {
  const { createContext } = require('react');
  return {
    mockShowToast: vi.fn(),
    mockAuthContext: createContext({
      user: { uid: 'test-uid', name: 'Test User', photoURL: '/test.jpg' },
      setUser: () => {},
      loading: false,
    }),
  };
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/image', () => ({
  default: (props) => <img {...props} />,
}));

vi.mock('@/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('@/runtime/providers/AuthProvider', () => ({
  AuthContext: mockAuthContext,
}));

vi.mock('@/components/ShareButton', () => ({
  default: () => <button type="button">Share</button>,
}));

vi.mock('@/components/UserLink', () => ({
  default: ({ name }) => <span>{name}</span>,
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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import PostDetailClient from '@/app/posts/[id]/PostDetailClient';
import { POST_TITLE_MAX_LENGTH } from '@/runtime/client/use-cases/post-use-cases';

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
// Helpers
// ---------------------------------------------------------------------------

/**
 * 進入編輯模式：等文章載入 → 點「更多選項」→ 點「編輯」。
 * @param {ReturnType<typeof userEvent.setup>} user - userEvent instance。
 */
async function enterEditMode(user) {
  // 等文章載入完成
  await screen.findByText('原始標題');

  // 打開 owner menu
  const menuBtn = screen.getByRole('button', { name: '更多選項' });
  await user.click(menuBtn);

  // 點編輯
  const editBtn = screen.getByRole('menuitem', { name: '編輯' });
  await user.click(editBtn);

  // 確認編輯表單出現
  await screen.findByPlaceholderText('標題');
}

const mockPost = {
  id: 'post-1',
  authorUid: 'test-uid',
  title: '原始標題',
  content: '原始內容',
  authorImgURL: '/test.jpg',
  postAt: { seconds: 1000, nanoseconds: 0, toDate: () => new Date(1000 * 1000) },
  likesCount: 0,
  commentsCount: 0,
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

/** 設定編輯表單測試需要的 Firestore SDK 邊界 stub。 */
function setupFirestoreMocks() {
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
  firestoreMocks.writeBatch.mockReturnValue({
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  });
  firestoreMocks.getDoc.mockImplementation(async (ref) => {
    if (ref.path === 'posts/post-1/likes/test-uid') return createDocSnapshot('test-uid', null);
    return createDocSnapshot('post-1', mockPost);
  });
  firestoreMocks.getDocs.mockResolvedValue({ docs: [], size: 0 });
}

// ---------------------------------------------------------------------------
// jsdom HTMLDialogElement patch (jsdom 未實作 showModal / close)
// ---------------------------------------------------------------------------
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function showModalPolyfill() {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function closePolyfill() {
    this.removeAttribute('open');
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PostDetailClient edit form validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFirestoreMocks();
  });

  describe('edit mode validation (US1+US2)', () => {
    it('shows merged error toast when both title and content are cleared', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PostDetailClient postId="post-1" />);
      await enterEditMode(user);

      const titleInput = screen.getByPlaceholderText('標題');
      const contentInput = screen.getByPlaceholderText('分享你的想法...');

      // Act — clear both fields and submit
      await user.clear(titleInput);
      await user.clear(contentInput);
      await user.click(screen.getByRole('button', { name: '更新' }));

      // Assert
      expect(mockShowToast).toHaveBeenCalledWith('請輸入標題和內容', 'error');
      expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
    });

    it('shows title error toast when only title is empty', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PostDetailClient postId="post-1" />);
      await enterEditMode(user);

      const titleInput = screen.getByPlaceholderText('標題');

      // Act — clear title only, keep content
      await user.clear(titleInput);
      await user.click(screen.getByRole('button', { name: '更新' }));

      // Assert
      expect(mockShowToast).toHaveBeenCalledWith('請輸入標題', 'error');
      expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
    });

    it('shows content error toast when only content is empty', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PostDetailClient postId="post-1" />);
      await enterEditMode(user);

      const contentInput = screen.getByPlaceholderText('分享你的想法...');

      // Act — clear content only, keep title
      await user.clear(contentInput);
      await user.click(screen.getByRole('button', { name: '更新' }));

      // Assert
      expect(mockShowToast).toHaveBeenCalledWith('請輸入內容', 'error');
      expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
    });

    it('shows length error toast when title exceeds 50 chars', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PostDetailClient postId="post-1" />);
      await enterEditMode(user);

      const titleInput = screen.getByPlaceholderText('標題');
      const longTitle = 'a'.repeat(POST_TITLE_MAX_LENGTH + 1);

      // Act — replace title with 51-char string
      await user.clear(titleInput);
      await user.type(titleInput, longTitle);
      await user.click(screen.getByRole('button', { name: '更新' }));

      // Assert
      expect(mockShowToast).toHaveBeenCalledWith('標題不可超過 50 字', 'error');
      expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    it('calls updateDoc with valid title and content', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PostDetailClient postId="post-1" />);
      await enterEditMode(user);

      const titleInput = screen.getByPlaceholderText('標題');
      const contentInput = screen.getByPlaceholderText('分享你的想法...');

      // Act — edit both fields to valid values and submit
      await user.clear(titleInput);
      await user.type(titleInput, '新標題');
      await user.clear(contentInput);
      await user.type(contentInput, '新內容');
      await user.click(screen.getByRole('button', { name: '更新' }));

      // Assert
      await waitFor(() => {
        expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(expect.any(Object), {
          title: '新標題',
          content: '新內容',
        });
      });
    });
  });
});
