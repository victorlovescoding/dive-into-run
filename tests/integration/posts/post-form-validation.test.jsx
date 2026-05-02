import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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
const { mockReplace, mockSearchParamsGet } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockSearchParamsGet: vi.fn().mockReturnValue(null),
}));

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}));

vi.mock('next/image', () => ({
  default: (props) => <img {...props} />,
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
// Imports (after vi.mock — Vitest hoists mocks above these)
// ---------------------------------------------------------------------------
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { ToastContext } from '@/runtime/providers/ToastProvider';
import PostPage from '@/app/posts/page';
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
// Test constants
// ---------------------------------------------------------------------------
const TEST_USER = {
  uid: 'test-uid',
  photoURL: '/test.jpg',
  name: 'Test User',
  email: 'test@test.com',
  bio: null,
  getIdToken: vi.fn().mockResolvedValue('token'),
};

/** @type {object[][]} */
let postPages = [[]];
/** @type {Map<string, object>} */
let documentsByPath = new Map();

/**
 * 設定 posts query 回傳頁面。
 * @param {...object[]} pages - 每次 posts query 要回傳的資料頁。
 */
function setPostPages(...pages) {
  postPages = pages.length > 0 ? pages : [[]];
}

/**
 * 設定 Firestore path 文件資料。
 * @param {string} path - 文件 path。
 * @param {object} data - 文件資料。
 */
function setDocument(path, data) {
  documentsByPath.set(path, data);
}

/**
 * 設定本檔 Firestore SDK 邊界 stub。
 */
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
      return { id: 'new-post-id', path: `${base.path}/new-post-id` };
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
  firestoreMocks.addDoc.mockResolvedValue({ id: 'new-post-id' });
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
    const data = documentsByPath.get(ref.path) ?? null;
    return createDocSnapshot(ref.id, data);
  });
  firestoreMocks.getDocs.mockImplementation(async (ref) => {
    if (ref.path === 'likes') return createQuerySnapshot([]);
    const page = postPages.length > 1 ? postPages.shift() : postPages[0];
    return createQuerySnapshot(page.map((post) => createDocSnapshot(String(post.id), post)));
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 渲染 PostPage 並等待初始載入完成。
 *
 * 回傳物件解構（非單值）以滿足 testing-library/render-result-naming-convention：
 * 規則將呼叫 `render()` 的 wrapper 視為 render-returning function，僅允許
 * `view` / `utils` 或解構命名；用解構保留語意正確的 `user` 名稱。
 * @returns {Promise<{
 *   user: import('@testing-library/user-event').UserEvent,
 *   toastValue: import('../../_helpers/provider-test-helpers').ToastContextValue
 * }>} userEvent 實例與 toast context spy。
 */
async function renderPostPage() {
  const user = userEvent.setup();
  const { toastValue } = renderWithAuthToast(<PostPage />, {
    authContext: AuthContext,
    toastContext: ToastContext,
    auth: { user: TEST_USER },
  });
  await waitFor(() => {
    expect(firestoreMocks.getDocs).toHaveBeenCalled();
  });
  return { user, toastValue };
}

/**
 * 開啟新增文章表單（點擊 ComposePrompt）。
 * @param {import('@testing-library/user-event').UserEvent} user - userEvent 實例。
 */
async function openComposeForm(user) {
  const composeButton = screen.getByText('分享你的跑步故事...');
  await user.click(composeButton);
}

/**
 * 送出文章表單（點擊送出按鈕）。
 * @param {import('@testing-library/user-event').UserEvent} user - userEvent 實例。
 * @param {string} [label] - 按鈕文字，預設 '發布'。
 */
async function submitForm(user, label = '發布') {
  const submitButton = screen.getByRole('button', { name: label });
  await user.click(submitButton);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  setPostPages([]);
  documentsByPath = new Map();
  setupFirestoreMocks();
  setDocument('posts/new-post-id', {
    id: 'new-post-id',
    title: 'Test Title',
    content: 'Test Content',
    authorUid: 'test-uid',
    authorImgURL: '/test.jpg',
    likesCount: 0,
    commentsCount: 0,
  });
  mockSearchParamsGet.mockReturnValue(null);
});

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

  global.IntersectionObserver = /** @type {typeof IntersectionObserver} */ (
    /** @type {unknown} */ (
      class FakeIntersectionObserver {
        constructor() {
          this.observe = vi.fn();
          this.unobserve = vi.fn();
          this.disconnect = vi.fn();
        }
      }
    )
  );
});

// ===========================================================================
// Group 1: Create mode validation (US1 + US2)
// ===========================================================================
describe('PostPage form validation', () => {
  describe('create mode validation (US1+US2)', () => {
    it('shows merged error toast when both title and content are empty', async () => {
      // Arrange
      const { user, toastValue } = await renderPostPage();
      await openComposeForm(user);

      // Act — leave both fields empty, submit
      await submitForm(user);

      // Assert
      await waitFor(() => {
        expect(toastValue.showToast).toHaveBeenCalledWith('請輸入標題和內容', 'error');
      });
      expect(firestoreMocks.addDoc).not.toHaveBeenCalled();
    });

    it('shows title error toast when title is empty but content is filled', async () => {
      // Arrange
      const { user, toastValue } = await renderPostPage();
      await openComposeForm(user);

      // Act — fill content only
      const contentInput = screen.getByPlaceholderText('分享你的想法...');
      await user.type(contentInput, '這是一篇測試文章的內容');
      await submitForm(user);

      // Assert
      await waitFor(() => {
        expect(toastValue.showToast).toHaveBeenCalledWith('請輸入標題', 'error');
      });
      expect(firestoreMocks.addDoc).not.toHaveBeenCalled();
    });

    it('shows content error toast when content is empty but title is filled', async () => {
      // Arrange
      const { user, toastValue } = await renderPostPage();
      await openComposeForm(user);

      // Act — fill title only
      const titleInput = screen.getByPlaceholderText('標題');
      await user.type(titleInput, '測試標題');
      await submitForm(user);

      // Assert
      await waitFor(() => {
        expect(toastValue.showToast).toHaveBeenCalledWith('請輸入內容', 'error');
      });
      expect(firestoreMocks.addDoc).not.toHaveBeenCalled();
    });

    it('shows length error toast when title exceeds 50 characters', async () => {
      // Arrange
      const { user, toastValue } = await renderPostPage();
      await openComposeForm(user);

      // Act — fill title with 51 characters
      const titleInput = screen.getByPlaceholderText('標題');
      const longTitle = 'a'.repeat(51);
      await user.type(titleInput, longTitle);

      const contentInput = screen.getByPlaceholderText('分享你的想法...');
      await user.type(contentInput, '有效內容');
      await submitForm(user);

      // Assert
      await waitFor(() => {
        expect(toastValue.showToast).toHaveBeenCalledWith('標題不可超過 50 字', 'error');
      });
      expect(firestoreMocks.addDoc).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Group 2: Edit mode validation (US1 + US2)
  // ===========================================================================
  describe('edit mode validation (US1+US2)', () => {
    it('shows error toast when editing a post and clearing title to empty', async () => {
      // Arrange — load a post owned by test user
      setPostPages([
        {
          id: 'post-edit-1',
          title: '原始標題',
          content: '原始內容',
          authorUid: 'test-uid',
          authorImgURL: '/test.jpg',
          likesCount: 0,
          commentsCount: 0,
        },
      ]);

      const { user, toastValue } = await renderPostPage();

      // Wait for post to appear
      await waitFor(() => {
        expect(screen.getByText('原始標題')).toBeInTheDocument();
      });

      // Open owner menu and click edit
      const menuButton = screen.getByRole('button', { name: '更多選項' });
      await user.click(menuButton);

      const editButton = screen.getByRole('menuitem', { name: '編輯' });
      await user.click(editButton);

      // Act — clear title, keep content, submit
      const titleInput = screen.getByPlaceholderText('標題');
      await user.clear(titleInput);
      await submitForm(user, '更新');

      // Assert
      await waitFor(() => {
        expect(toastValue.showToast).toHaveBeenCalledWith('請輸入標題', 'error');
      });
      expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Group 3: Happy path
  // ===========================================================================
  describe('happy path', () => {
    it('calls createPost with correct args when input is valid', async () => {
      // Arrange
      const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      const { user, toastValue } = await renderPostPage();
      await openComposeForm(user);

      // Act — fill valid title and content
      const titleInput = screen.getByPlaceholderText('標題');
      const contentInput = screen.getByPlaceholderText('分享你的想法...');
      await user.type(titleInput, '有效標題');
      await user.type(contentInput, '有效的文章內容');
      await submitForm(user);

      // Assert
      await waitFor(() => {
        expect(firestoreMocks.addDoc).toHaveBeenCalledWith(expect.anything(), {
          authorUid: 'test-uid',
          title: '有效標題',
          content: '有效的文章內容',
          authorImgURL: '/test.jpg',
          authorName: 'Test User',
          postAt: { __type: 'serverTimestamp' },
          likesCount: 0,
          commentsCount: 0,
        });
      });
      await waitFor(() => {
        expect(toastValue.showToast).toHaveBeenCalledWith('發佈文章成功');
      });

      scrollToSpy.mockRestore();
    });
  });
});
