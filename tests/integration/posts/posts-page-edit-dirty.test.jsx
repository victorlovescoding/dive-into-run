import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo } from 'react';
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
import { AuthContext } from '@/runtime/providers/AuthProvider';
import PostPage from '@/app/posts/page';
import {
  createFirestoreDocSnapshot as createDocSnapshot,
  createFirestoreQuerySnapshot as createQuerySnapshot,
} from '../../_helpers/factories';

// ---------------------------------------------------------------------------
// Hoisted shared state (available inside vi.mock factories)
// ---------------------------------------------------------------------------
const { mockShowToast, mockReplace, mockSearchParamsGet, mockAuthContext } = vi.hoisted(() => {
  const { createContext } = require('react');
  return {
    mockShowToast: vi.fn(),
    mockReplace: vi.fn(),
    mockSearchParamsGet: vi.fn().mockReturnValue(null),
    mockAuthContext: createContext({ user: null, setUser: () => {}, loading: false }),
  };
});

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
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
  // 測試替身：把 next/image 換成原生 img；alt 由 props 帶入。

  default: (props) => <img {...props} />,
}));

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

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------
const TEST_USER = {
  uid: 'test-uid',
  photoURL: 'https://example.com/me.jpg',
  name: 'Test User',
  email: 'test@test.com',
  bio: null,
  getIdToken: vi.fn().mockResolvedValue('token'),
};

/** @type {Array<object>} */
const mockPosts = [
  {
    id: 'post-a',
    authorUid: 'test-uid',
    authorName: 'Test User',
    authorImgURL: '',
    title: 'Post A title',
    content: 'Post A content',
    likesCount: 0,
    commentsCount: 0,
    postAt: { toDate: () => new Date('2026-04-15T06:00:00Z') },
  },
  {
    id: 'post-b',
    authorUid: 'test-uid',
    authorName: 'Test User',
    authorImgURL: '',
    title: 'Post B title',
    content: 'Post B content',
    likesCount: 0,
    commentsCount: 0,
    postAt: { toDate: () => new Date('2026-04-15T07:00:00Z') },
  },
];

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
 * 用 AuthContext 包裹子元件，提供測試用使用者。
 * @param {object} props - 元件 props。
 * @param {import('react').ReactNode} props.children - 子元件。
 * @param {object | null} [props.user] - 覆寫使用者，預設 TEST_USER。
 * @returns {import('react').ReactElement} 包裹後的元件。
 */
function AuthWrapper({ children, user = TEST_USER }) {
  // useMemo 避免 Provider value 每次 render 都建新物件 → 觸發 react/jsx-no-constructed-context-values
  const value = useMemo(() => ({ user, setUser: vi.fn(), loading: false }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * 渲染 PostPage（含 AuthWrapper）並等待初始 API 呼叫完成。
 *
 * 回傳物件解構（非單值）以滿足 testing-library/render-result-naming-convention：
 * 規則將呼叫 `render()` 的 wrapper 視為 render-returning function，僅允許
 * `view` / `utils` 或解構命名；用解構保留語意正確的 `user` 名稱。
 * @returns {Promise<{ user: import('@testing-library/user-event').UserEvent }>} userEvent 實例。
 */
async function renderPostPage() {
  const user = userEvent.setup();
  render(
    <AuthWrapper>
      <PostPage />
    </AuthWrapper>,
  );
  await waitFor(() => {
    expect(firestoreMocks.getDocs).toHaveBeenCalled();
  });
  // 等文章載入完成
  await screen.findByText('Post A title');
  return { user };
}

/**
 * 進入目標 post 的編輯模式：點該 post 的「更多選項」→ 點「編輯」。
 * @param {import('@testing-library/user-event').UserEvent} user - userEvent instance。
 * @param {number} index - post 在列表中的 index（0 = post A, 1 = post B）。
 */
async function enterEditMode(user, index) {
  const menuButtons = screen.getAllByRole('button', { name: '更多選項' });
  await user.click(menuButtons[index]);

  const editBtn = await screen.findByRole('menuitem', { name: '編輯' });
  await user.click(editBtn);

  // 確認 modal 表單出現
  await screen.findByPlaceholderText('標題');
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  setPostPages(mockPosts);
  documentsByPath = new Map();
  setupFirestoreMocks();
  mockSearchParamsGet.mockReturnValue(null);
});

// ===========================================================================
// Posts page edit dirty gate
// ===========================================================================
describe('Posts page edit dirty gate', () => {
  it('keeps submit button disabled when no modification happens', async () => {
    // Arrange
    const { user } = await renderPostPage();
    await enterEditMode(user, 0);

    // Act
    const submitBtn = screen.getByRole('button', { name: /更新/ });

    // Assert — 按鈕預設為 disabled（未改動）
    expect(submitBtn).toBeDisabled();

    // Act — 即使點擊也不會呼叫 updatePost
    await user.click(submitBtn);

    // Assert
    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
  });

  it('disables submit again after typing then reverting the modification', async () => {
    // Arrange
    const { user } = await renderPostPage();
    await enterEditMode(user, 0);
    const titleInput = screen.getByPlaceholderText('標題');

    // Act — 先 dirty
    await user.type(titleInput, ' X');

    // Assert — 改動後按鈕 enabled
    const submitBtn = screen.getByRole('button', { name: /更新/ });
    expect(submitBtn).toBeEnabled();

    // Act — 回復原狀（刪除 ' X' 兩個字元）
    await user.type(titleInput, '{Backspace}{Backspace}');

    // Assert — 回到原樣後按鈕再次 disabled
    expect(titleInput).toHaveValue('Post A title');
    expect(submitBtn).toBeDisabled();
  });

  it('submits through the real service path and persists trimmed values', async () => {
    // Arrange
    const { user } = await renderPostPage();
    await enterEditMode(user, 0);
    const titleInput = screen.getByPlaceholderText('標題');
    const contentInput = screen.getByPlaceholderText('分享你的想法...');

    // Act
    await user.clear(titleInput);
    await user.type(titleInput, '  new title  ');
    await user.clear(contentInput);
    await user.type(contentInput, '  new content  ');
    await user.click(screen.getByRole('button', { name: /更新/ }));

    // Assert — real service layer trims before Firestore update.
    await waitFor(() => {
      expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'posts/post-a' }),
        {
          title: 'new title',
          content: 'new content',
        },
      );
    });
  });

  it('restores original values when re-opening post A after cancel', async () => {
    // Arrange
    const { user } = await renderPostPage();
    await enterEditMode(user, 0);
    const titleInput = screen.getByPlaceholderText('標題');

    // Act — 改動後關閉對話框（不送出）
    await user.type(titleInput, ' X');
    expect(screen.getByRole('button', { name: /更新/ })).toBeEnabled();
    const closeBtn = screen.getByRole('button', { name: '關閉' });
    await user.click(closeBtn);

    // Act — 再次打開 post A 的編輯
    await enterEditMode(user, 0);

    // Assert — 欄位回到原始值、按鈕 disabled
    const reopenedTitle = screen.getByPlaceholderText('標題');
    expect(reopenedTitle).toHaveValue('Post A title');
    expect(screen.getByRole('button', { name: /更新/ })).toBeDisabled();
  });

  it('switches original baseline to post B when editing B after closing A', async () => {
    // Arrange
    const { user } = await renderPostPage();

    // Act — 先編輯 A 然後關閉
    await enterEditMode(user, 0);
    const closeBtnA = screen.getByRole('button', { name: '關閉' });
    await user.click(closeBtnA);

    // Act — 再編輯 B
    await enterEditMode(user, 1);

    // Assert — 欄位為 B 的原始值，且按鈕 disabled（基準是 B，不是 A）
    const titleInput = screen.getByPlaceholderText('標題');
    const contentInput = screen.getByPlaceholderText('分享你的想法...');
    expect(titleInput).toHaveValue('Post B title');
    expect(contentInput).toHaveValue('Post B content');
    expect(screen.getByRole('button', { name: /更新/ })).toBeDisabled();
  });
});

// ===========================================================================
// US2 sanity — 新增文章流程不受 dirty gate 影響
// ===========================================================================
describe('Posts page new-post flow (sanity — not affected by dirty gate)', () => {
  it('發表文章 button opens dialog, button NOT disabled, submit calls createPost', async () => {
    // Arrange — 空 feed，僅驗證新增模式
    setPostPages([]);
    setDocument('posts/new-post-id', {
      id: 'new-post-id',
      authorUid: TEST_USER.uid,
      authorName: TEST_USER.name,
      authorImgURL: '',
      title: 'my new title',
      content: 'my new content',
      likesCount: 0,
      commentsCount: 0,
      postAt: { toDate: () => new Date('2026-04-16T00:00:00Z') },
    });

    const user = userEvent.setup();
    render(
      <AuthWrapper>
        <PostPage />
      </AuthWrapper>,
    );
    await waitFor(() => {
      expect(firestoreMocks.getDocs).toHaveBeenCalled();
    });
    // 等空狀態出現（loading 結束）
    await screen.findByText('還沒有文章，成為第一個分享的人吧！');

    // Act — 點 ComposePrompt 開 modal（新增模式）
    const prompt = screen.getByRole('button', { name: /分享你的跑步故事/ });
    await user.click(prompt);

    // Assert — 新增模式下，送出按鈕預設 NOT disabled（bypass dirty gate）
    const submitBtn = await screen.findByRole('button', { name: /發布/ });
    expect(submitBtn).toBeEnabled();

    // Act — 填入標題與內文後送出
    const titleInput = screen.getByPlaceholderText('標題');
    const contentInput = screen.getByPlaceholderText('分享你的想法...');
    await user.type(titleInput, 'my new title');
    await user.type(contentInput, 'my new content');
    await user.click(submitBtn);

    // Assert — createPost 被以正確 payload 呼叫
    await waitFor(() => {
      expect(firestoreMocks.addDoc).toHaveBeenCalledWith(expect.anything(), {
        authorUid: TEST_USER.uid,
        title: 'my new title',
        content: 'my new content',
        authorImgURL: TEST_USER.photoURL,
        authorName: TEST_USER.name,
        postAt: { __type: 'serverTimestamp' },
        likesCount: 0,
        commentsCount: 0,
      });
    });
    // updatePost 不應被呼叫（確保走的是新增分支）
    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
  });
});
