import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Hoisted shared state (available inside vi.mock factories)
// ---------------------------------------------------------------------------
const { mockShowToast, mockPush, mockReplace, mockAuthContext } = vi.hoisted(() => {
  // eslint-disable-next-line global-require -- dynamic require in hoisted factory
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

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: mockAuthContext,
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
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
  validatePostInput: vi.fn(),
  POST_NOT_FOUND_MESSAGE: '文章不存在',
}));

vi.mock('@/lib/firebase-notifications', () => ({
  notifyPostNewComment: vi.fn(),
  notifyPostCommentReply: vi.fn(),
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
import {
  getPostDetail,
  getLatestComments,
  hasUserLikedPost,
  getMoreComments,
  deletePost,
} from '@/lib/firebase-posts';

/** @type {import('vitest').Mock} */
const mockedGetPostDetail = /** @type {import('vitest').Mock} */ (getPostDetail);
/** @type {import('vitest').Mock} */
const mockedGetLatestComments = /** @type {import('vitest').Mock} */ (getLatestComments);
/** @type {import('vitest').Mock} */
const mockedHasUserLikedPost = /** @type {import('vitest').Mock} */ (hasUserLikedPost);
/** @type {import('vitest').Mock} */
const mockedGetMoreComments = /** @type {import('vitest').Mock} */ (getMoreComments);
/** @type {import('vitest').Mock} */
const mockedDeletePost = /** @type {import('vitest').Mock} */ (deletePost);

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
    mockedGetPostDetail.mockResolvedValue(mockPost);
    mockedGetLatestComments.mockResolvedValue([]);
    mockedHasUserLikedPost.mockResolvedValue(false);
    mockedGetMoreComments.mockResolvedValue([]);
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
    mockedDeletePost.mockRejectedValue(new Error('文章不存在'));

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
    mockedDeletePost.mockRejectedValue(new Error('Firestore batch failed'));

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
    mockedDeletePost.mockResolvedValue({ ok: true });

    const user = userEvent.setup();
    render(<PostDetailClient postId="post-1" />);
    await clickDelete(user);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/posts?toast=文章已刪除');
    });
    expect(mockShowToast).not.toHaveBeenCalledWith(expect.stringContaining('失敗'), 'error');
  });
});
