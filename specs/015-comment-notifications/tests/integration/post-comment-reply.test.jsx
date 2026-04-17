import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

vi.mock('@/lib/firebase-client', () => ({
  db: {},
  auth: {},
  provider: {},
}));

vi.mock('firebase/firestore', () => ({
  Timestamp: { fromDate: vi.fn((d) => d) },
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
  serverTimestamp: vi.fn(),
  writeBatch: vi.fn(),
  runTransaction: vi.fn(),
  increment: vi.fn(),
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
// Mocks -- firebase-posts
// ---------------------------------------------------------------------------

vi.mock('@/lib/firebase-posts', () => ({
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
}));

// ---------------------------------------------------------------------------
// Mocks -- firebase-notifications
// ---------------------------------------------------------------------------

vi.mock('@/lib/firebase-notifications', () => ({
  notifyPostNewComment: vi.fn(() => Promise.resolve()),
  notifyPostCommentReply: vi.fn(() => Promise.resolve()),
}));

// ---------------------------------------------------------------------------
// Mocks -- contexts
// ---------------------------------------------------------------------------

vi.mock('@/contexts/AuthContext', async () => {
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
vi.mock('@/contexts/ToastContext', async () => {
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

import {
  getPostDetail,
  addComment,
  getLatestComments,
  getCommentById,
  hasUserLikedPost,
} from '@/lib/firebase-posts';
import { notifyPostNewComment, notifyPostCommentReply } from '@/lib/firebase-notifications';
import PostDetailClient from '@/app/posts/[id]/PostDetailClient';

// cast to vi.Mock for convenience
const mockedGetPostDetail = /** @type {import('vitest').Mock} */ (getPostDetail);
const mockedAddComment = /** @type {import('vitest').Mock} */ (addComment);
const mockedGetLatestComments = /** @type {import('vitest').Mock} */ (getLatestComments);
const mockedGetCommentById = /** @type {import('vitest').Mock} */ (getCommentById);
const mockedHasUserLikedPost = /** @type {import('vitest').Mock} */ (hasUserLikedPost);
const mockedNotifyPostNewComment = /** @type {import('vitest').Mock} */ (notifyPostNewComment);
const mockedNotifyPostCommentReply = /** @type {import('vitest').Mock} */ (notifyPostCommentReply);

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PostDetailClient — 留言跟帖通知 (notifyPostCommentReply)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedGetPostDetail.mockResolvedValue(mockPost);
    mockedGetLatestComments.mockResolvedValue([]);
    mockedHasUserLikedPost.mockResolvedValue(false);
    mockedAddComment.mockResolvedValue({ id: 'comment1' });
    mockedGetCommentById.mockResolvedValue({
      id: 'comment1',
      authorUid: 'user1',
      authorName: 'Test User',
      authorImgURL: 'http://photo.jpg',
      comment: '測試留言',
      createdAt: new Date(),
    });
  });

  it('送出留言後同時呼叫 notifyPostNewComment 和 notifyPostCommentReply', async () => {
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

    // 驗證 addComment 被呼叫
    await waitFor(() => {
      expect(mockedAddComment).toHaveBeenCalledWith(
        'post1',
        expect.objectContaining({ comment: '測試留言' }),
      );
    });

    // 驗證 notifyPostNewComment 被呼叫（留言者 user1 !== 文章作者 author1）
    await waitFor(() => {
      expect(mockedNotifyPostNewComment).toHaveBeenCalledWith(
        'post1',
        '測試文章',
        'author1',
        'comment1',
        {
          uid: 'user1',
          name: 'Test User',
          photoURL: 'http://photo.jpg',
        },
      );
    });

    // 驗證 notifyPostCommentReply 也被呼叫（RED — 目前 PostDetailClient 尚未呼叫此函式）
    await waitFor(() => {
      expect(mockedNotifyPostCommentReply).toHaveBeenCalled();
    });
  });

  it('notifyPostCommentReply 傳入正確參數 (postId, title, authorUid, commentId, actor)', async () => {
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

    // 等 addComment 完成
    await waitFor(() => {
      expect(mockedAddComment).toHaveBeenCalled();
    });

    // 驗證 notifyPostCommentReply 帶正確參數（RED — 尚未實作）
    await waitFor(() => {
      expect(mockedNotifyPostCommentReply).toHaveBeenCalledWith(
        'post1',
        '測試文章',
        'author1',
        'comment1',
        {
          uid: 'user1',
          name: 'Test User',
          photoURL: 'http://photo.jpg',
        },
      );
    });
  });
});
