import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Hoisted shared state (available inside vi.mock factories)
// ---------------------------------------------------------------------------
const { mockShowToast, mockAuthContext } = vi.hoisted(() => {
  // eslint-disable-next-line global-require -- dynamic require in hoisted factory
  const { createContext } = require('react');
  return {
    mockShowToast: vi.fn(),
    mockAuthContext: createContext({
      user: { uid: 'test-uid', name: 'Test User', photoURL: 'test.jpg' },
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

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: mockAuthContext,
}));

vi.mock('@/components/ShareButton', () => ({
  default: () => <button type="button">Share</button>,
}));

vi.mock('@/components/UserLink', () => ({
  default: ({ name }) => <span>{name}</span>,
}));

vi.mock('@/lib/firebase-notifications', () => ({
  notifyPostNewComment: vi.fn(),
  notifyPostCommentReply: vi.fn(),
}));

vi.mock('@/lib/firebase-client', () => ({ db: {} }));

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

vi.mock('@/lib/firebase-posts', async (importOriginal) => {
  const original = /** @type {import('@/lib/firebase-posts')} */ (await importOriginal());
  return {
    validatePostInput: original.validatePostInput,
    POST_TITLE_MAX_LENGTH: original.POST_TITLE_MAX_LENGTH,
    POST_CONTENT_MAX_LENGTH: original.POST_CONTENT_MAX_LENGTH,
    POST_NOT_FOUND_MESSAGE: original.POST_NOT_FOUND_MESSAGE,
    // Mock all Firebase calls
    getPostDetail: vi.fn(),
    addComment: vi.fn(),
    getLatestComments: vi.fn(),
    getCommentById: vi.fn(),
    toggleLikePost: vi.fn(),
    hasUserLikedPost: vi.fn(),
    updatePost: vi.fn(),
    updateComment: vi.fn(),
    deletePost: vi.fn(),
    deleteComment: vi.fn(),
    getMoreComments: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import PostDetailClient from '@/app/posts/[id]/PostDetailClient';
import {
  getPostDetail,
  hasUserLikedPost,
  getLatestComments,
  updatePost,
} from '@/lib/firebase-posts';

const mockedGetPostDetail = /** @type {import('vitest').Mock} */ (getPostDetail);
const mockedHasUserLikedPost = /** @type {import('vitest').Mock} */ (hasUserLikedPost);
const mockedGetLatestComments = /** @type {import('vitest').Mock} */ (getLatestComments);
const mockedUpdatePost = /** @type {import('vitest').Mock} */ (updatePost);

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

  global.IntersectionObserver = /** @type {any} */ (
    class IntersectionObserver {
      constructor() {
        this.observe = vi.fn();
        this.unobserve = vi.fn();
        this.disconnect = vi.fn();
      }
    }
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 進入編輯模式：等文章載入 → 點「更多選項」直到展開 → 點「編輯」。
 * 由於 toggleOwnerMenu 是 toggle 行為，在 re-open 情境下可能需要點兩次
 * （前次 close dialog 後 openMenuPostId 未被重置）。
 * @param {ReturnType<typeof userEvent.setup>} user - userEvent instance。
 */
async function enterEditMode(user) {
  // 等文章載入完成
  await screen.findByText('原始標題');

  const menuBtn = screen.getByRole('button', { name: '更多選項' });

  // 若 menu 未展開就點擊使其展開；若已展開則跳過
  if (menuBtn.getAttribute('aria-expanded') !== 'true') {
    await user.click(menuBtn);
  }

  // 點編輯
  const editBtn = await screen.findByRole('menuitem', { name: '編輯' });
  await user.click(editBtn);

  // 確認編輯表單出現
  await screen.findByPlaceholderText('標題');
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();

  mockedGetPostDetail.mockResolvedValue({
    id: 'post-1',
    authorUid: 'test-uid',
    title: '原始標題',
    content: '原始內容',
    authorImgURL: 'test.jpg',
    postAt: {
      seconds: 1000,
      nanoseconds: 0,
      toDate: () => new Date(1000 * 1000),
    },
    likesCount: 0,
    commentsCount: 0,
  });

  mockedHasUserLikedPost.mockResolvedValue(false);
  mockedGetLatestComments.mockResolvedValue([]);
  mockedUpdatePost.mockResolvedValue(undefined);
});

// ===========================================================================
// PostDetailClient edit dirty gate
// ===========================================================================
describe('PostDetailClient edit dirty gate', () => {
  it('keeps submit button disabled when no modification happens', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<PostDetailClient postId="post-1" />);
    await enterEditMode(user);

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
    const user = userEvent.setup();
    render(<PostDetailClient postId="post-1" />);
    await enterEditMode(user);
    const titleInput = screen.getByPlaceholderText('標題');

    // Act — 先 dirty
    await user.type(titleInput, ' X');

    // Assert — 改動後按鈕 enabled
    const submitBtn = screen.getByRole('button', { name: /更新/ });
    expect(submitBtn).toBeEnabled();

    // Act — 回復原狀（刪除 ' X' 兩個字元）
    await user.type(titleInput, '{Backspace}{Backspace}');

    // Assert — 回到原樣後按鈕再次 disabled
    expect(titleInput).toHaveValue('原始標題');
    expect(submitBtn).toBeDisabled();
  });

  it('submits with raw (un-trimmed) values — trim is service-layer responsibility', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<PostDetailClient postId="post-1" />);
    await enterEditMode(user);
    const titleInput = screen.getByPlaceholderText('標題');
    const contentInput = screen.getByPlaceholderText('分享你的想法...');

    // Act
    await user.clear(titleInput);
    await user.type(titleInput, '  新標題  ');
    await user.clear(contentInput);
    await user.type(contentInput, '  新內容  ');
    await user.click(screen.getByRole('button', { name: /更新/ }));

    // Assert — UI 不 trim；trim 為 service layer（T007）責任
    await waitFor(() => {
      expect(mockedUpdatePost).toHaveBeenCalledWith('post-1', {
        title: '  新標題  ',
        content: '  新內容  ',
      });
    });
  });

  it('keeps submit disabled when only trailing whitespace is appended to title (trim compare)', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<PostDetailClient postId="post-1" />);
    await enterEditMode(user);
    const titleInput = screen.getByPlaceholderText('標題');

    // Act — 在原始標題後加上 2 個空白
    await user.type(titleInput, '  ');

    // Assert — trim 後與原始值相同，按鈕 disabled
    expect(titleInput).toHaveValue('原始標題  ');
    expect(screen.getByRole('button', { name: /更新/ })).toBeDisabled();
  });

  it('restores original values when re-opening the same post after cancel', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<PostDetailClient postId="post-1" />);
    await enterEditMode(user);
    const titleInput = screen.getByPlaceholderText('標題');

    // Act — 改動後關閉對話框（不送出）
    await user.type(titleInput, ' X');
    expect(screen.getByRole('button', { name: /更新/ })).toBeEnabled();
    const closeBtn = screen.getByRole('button', { name: '關閉' });
    await user.click(closeBtn);

    // Act — 再次進入編輯模式
    await enterEditMode(user);

    // Assert — 欄位回到原始值、按鈕 disabled
    const reopenedTitle = screen.getByPlaceholderText('標題');
    expect(reopenedTitle).toHaveValue('原始標題');
    expect(screen.getByRole('button', { name: /更新/ })).toBeDisabled();
  });
});
