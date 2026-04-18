import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
  POST_TITLE_MAX_LENGTH,
} from '@/lib/firebase-posts';

const mockedGetPostDetail = /** @type {import('vitest').Mock} */ (getPostDetail);
const mockedHasUserLikedPost = /** @type {import('vitest').Mock} */ (hasUserLikedPost);
const mockedGetLatestComments = /** @type {import('vitest').Mock} */ (getLatestComments);
const mockedUpdatePost = /** @type {import('vitest').Mock} */ (updatePost);

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

    mockedGetPostDetail.mockResolvedValue({
      id: 'post-1',
      authorUid: 'test-uid',
      title: '原始標題',
      content: '原始內容',
      authorImgURL: '/test.jpg',
      postAt: { seconds: 1000, nanoseconds: 0, toDate: () => new Date(1000 * 1000) },
      likesCount: 0,
      commentsCount: 0,
    });

    mockedHasUserLikedPost.mockResolvedValue(false);
    mockedGetLatestComments.mockResolvedValue([]);
    mockedUpdatePost.mockResolvedValue(undefined);
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
      expect(mockedUpdatePost).not.toHaveBeenCalled();
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
      expect(mockedUpdatePost).not.toHaveBeenCalled();
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
      expect(mockedUpdatePost).not.toHaveBeenCalled();
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
      expect(mockedUpdatePost).not.toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    it('calls updatePost with valid title and content', async () => {
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
        expect(mockedUpdatePost).toHaveBeenCalledWith('post-1', {
          title: '新標題',
          content: '新內容',
        });
      });
    });
  });
});
