import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { useMemo } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

vi.mock('next/image', () => ({
  default: (props) => <img {...props} />,
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
  const actual = /** @type {import('@/runtime/client/use-cases/post-use-cases')} */ (
    await importOriginal()
  );
  return {
    validatePostInput: actual.validatePostInput,
    POST_TITLE_MAX_LENGTH: actual.POST_TITLE_MAX_LENGTH,
    POST_CONTENT_MAX_LENGTH: actual.POST_CONTENT_MAX_LENGTH,
    createPost: vi.fn().mockResolvedValue({ id: 'new-post-id' }),
    updatePost: vi.fn().mockResolvedValue(undefined),
    getLatestPosts: vi.fn().mockResolvedValue([]),
    getPostDetail: vi.fn().mockResolvedValue({
      id: 'new-post-id',
      title: 'Test Title',
      content: 'Test Content',
      authorUid: 'test-uid',
      authorImgURL: '/test.jpg',
      likesCount: 0,
      commentsCount: 0,
    }),
    toggleLikePost: vi.fn().mockResolvedValue('success'),
    hasUserLikedPosts: vi.fn().mockResolvedValue(new Set()),
    deletePost: vi.fn().mockResolvedValue({ ok: true }),
    getMorePosts: vi.fn().mockResolvedValue([]),
  };
});

// ---------------------------------------------------------------------------
// Imports (after vi.mock — Vitest hoists mocks above these)
// ---------------------------------------------------------------------------
import { AuthContext } from '@/runtime/providers/AuthProvider';
import PostPage from '@/app/posts/page';
import {
  createPost,
  updatePost,
  getLatestPosts,
  getPostDetail,
  hasUserLikedPosts,
} from '@/runtime/client/use-cases/post-use-cases';

/** @type {import('vitest').Mock} */
const mockedCreatePost = /** @type {import('vitest').Mock} */ (createPost);
/** @type {import('vitest').Mock} */
const mockedUpdatePost = /** @type {import('vitest').Mock} */ (updatePost);
/** @type {import('vitest').Mock} */
const mockedGetLatestPosts = /** @type {import('vitest').Mock} */ (getLatestPosts);
/** @type {import('vitest').Mock} */
const mockedGetPostDetail = /** @type {import('vitest').Mock} */ (getPostDetail);
/** @type {import('vitest').Mock} */
const mockedHasUserLikedPosts = /** @type {import('vitest').Mock} */ (hasUserLikedPosts);

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
  const authValue = useMemo(() => ({ user, setUser: vi.fn(), loading: false }), [user]);
  return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>;
}

/**
 * 渲染 PostPage 並等待初始載入完成。
 * @returns {Promise<import('@testing-library/user-event').UserEvent>} userEvent 實例。
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
  return user;
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
  mockedGetLatestPosts.mockResolvedValue([]);
  mockedCreatePost.mockResolvedValue({ id: 'new-post-id' });
  mockedGetPostDetail.mockResolvedValue({
    id: 'new-post-id',
    title: 'Test Title',
    content: 'Test Content',
    authorUid: 'test-uid',
    authorImgURL: '/test.jpg',
    likesCount: 0,
    commentsCount: 0,
  });
  mockedHasUserLikedPosts.mockResolvedValue(new Set());
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
      const user = await renderPostPage();
      await openComposeForm(user);

      // Act — leave both fields empty, submit
      await submitForm(user);

      // Assert
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('請輸入標題和內容', 'error');
      });
      expect(mockedCreatePost).not.toHaveBeenCalled();
    });

    it('shows title error toast when title is empty but content is filled', async () => {
      // Arrange
      const user = await renderPostPage();
      await openComposeForm(user);

      // Act — fill content only
      const contentInput = screen.getByPlaceholderText('分享你的想法...');
      await user.type(contentInput, '這是一篇測試文章的內容');
      await submitForm(user);

      // Assert
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('請輸入標題', 'error');
      });
      expect(mockedCreatePost).not.toHaveBeenCalled();
    });

    it('shows content error toast when content is empty but title is filled', async () => {
      // Arrange
      const user = await renderPostPage();
      await openComposeForm(user);

      // Act — fill title only
      const titleInput = screen.getByPlaceholderText('標題');
      await user.type(titleInput, '測試標題');
      await submitForm(user);

      // Assert
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('請輸入內容', 'error');
      });
      expect(mockedCreatePost).not.toHaveBeenCalled();
    });

    it('shows length error toast when title exceeds 50 characters', async () => {
      // Arrange
      const user = await renderPostPage();
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
        expect(mockShowToast).toHaveBeenCalledWith('標題不可超過 50 字', 'error');
      });
      expect(mockedCreatePost).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Group 2: Edit mode validation (US1 + US2)
  // ===========================================================================
  describe('edit mode validation (US1+US2)', () => {
    it('shows error toast when editing a post and clearing title to empty', async () => {
      // Arrange — load a post owned by test user
      mockedGetLatestPosts.mockResolvedValueOnce([
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
      mockedHasUserLikedPosts.mockResolvedValueOnce(new Set());

      const user = userEvent.setup();
      render(
        <AuthWrapper>
          <PostPage />
        </AuthWrapper>,
      );

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
        expect(mockShowToast).toHaveBeenCalledWith('請輸入標題', 'error');
      });
      expect(mockedUpdatePost).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Group 3: Happy path
  // ===========================================================================
  describe('happy path', () => {
    it('calls createPost with correct args when input is valid', async () => {
      // Arrange
      const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      const user = await renderPostPage();
      await openComposeForm(user);

      // Act — fill valid title and content
      const titleInput = screen.getByPlaceholderText('標題');
      const contentInput = screen.getByPlaceholderText('分享你的想法...');
      await user.type(titleInput, '有效標題');
      await user.type(contentInput, '有效的文章內容');
      await submitForm(user);

      // Assert
      await waitFor(() => {
        expect(mockedCreatePost).toHaveBeenCalledWith({
          title: '有效標題',
          content: '有效的文章內容',
          user: expect.objectContaining({ uid: 'test-uid', photoURL: '/test.jpg' }),
        });
      });
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('發佈文章成功');
      });

      scrollToSpy.mockRestore();
    });
  });
});
