import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo } from 'react';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import PostPage from '@/app/posts/page';
import {
  getLatestPosts,
  hasUserLikedPosts,
  updatePost,
  getMorePosts,
  createPost,
  getPostDetail,
} from '@/runtime/client/use-cases/post-use-cases';

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
  serverTimestamp: vi.fn(),
  limit: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: vi.fn(),
  increment: vi.fn(),
  collectionGroup: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
  startAfter: vi.fn(),
  documentId: vi.fn(),
}));

vi.mock('@/runtime/client/use-cases/post-use-cases', async (importOriginal) => {
  const original = /** @type {import('@/runtime/client/use-cases/post-use-cases')} */ (
    await importOriginal()
  );
  return {
    validatePostInput: original.validatePostInput,
    POST_TITLE_MAX_LENGTH: original.POST_TITLE_MAX_LENGTH,
    POST_CONTENT_MAX_LENGTH: original.POST_CONTENT_MAX_LENGTH,
    getLatestPosts: vi.fn(),
    hasUserLikedPosts: vi.fn(),
    createPost: vi.fn(),
    updatePost: vi.fn(),
    getPostDetail: vi.fn(),
    toggleLikePost: vi.fn(),
    deletePost: vi.fn(),
    getMorePosts: vi.fn(),
  };
});

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

// ---------------------------------------------------------------------------
// Typed mock handles (vi.mock above is hoisted by Vitest before these lines)
// ---------------------------------------------------------------------------
const mockedGetLatestPosts = /** @type {import('vitest').Mock} */ (getLatestPosts);
const mockedHasUserLikedPosts = /** @type {import('vitest').Mock} */ (hasUserLikedPosts);
const mockedUpdatePost = /** @type {import('vitest').Mock} */ (updatePost);
const mockedGetMorePosts = /** @type {import('vitest').Mock} */ (getMorePosts);
const mockedCreatePost = /** @type {import('vitest').Mock} */ (createPost);
const mockedGetPostDetail = /** @type {import('vitest').Mock} */ (getPostDetail);

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
    expect(mockedGetLatestPosts).toHaveBeenCalled();
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
  mockedGetLatestPosts.mockResolvedValue(mockPosts);
  mockedHasUserLikedPosts.mockResolvedValue(new Set());
  mockedGetMorePosts.mockResolvedValue([]);
  mockedUpdatePost.mockResolvedValue(undefined);
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
    expect(mockedUpdatePost).not.toHaveBeenCalled();
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

  it('submits with raw (un-trimmed) values — trim is service-layer responsibility', async () => {
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

    // Assert — UI 不 trim；trim 為 service layer（T007）責任
    await waitFor(() => {
      expect(mockedUpdatePost).toHaveBeenCalledWith('post-a', {
        title: '  new title  ',
        content: '  new content  ',
      });
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
    mockedGetLatestPosts.mockResolvedValue([]);
    mockedCreatePost.mockResolvedValue({ id: 'new-post-id' });
    mockedGetPostDetail.mockResolvedValue({
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
      expect(mockedGetLatestPosts).toHaveBeenCalled();
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
      expect(mockedCreatePost).toHaveBeenCalledWith({
        title: 'my new title',
        content: 'my new content',
        user: TEST_USER,
      });
    });
    // updatePost 不應被呼叫（確保走的是新增分支）
    expect(mockedUpdatePost).not.toHaveBeenCalled();
  });
});
