import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  addComment,
  getLatestComments,
  getCommentById,
  toggleLikePost,
  hasUserLikedPost,
  getMoreComments,
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
const mockedAddComment = /** @type {import('vitest').Mock} */ (addComment);
/** @type {import('vitest').Mock} */
const mockedGetCommentById = /** @type {import('vitest').Mock} */ (getCommentById);

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
  commentsCount: 2,
};

const mockComments = [
  {
    id: 'comment-1',
    authorUid: 'user-2',
    authorName: '小華',
    authorImgURL: '/avatar2.jpg',
    comment: '跑得好！',
    createdAt: { toDate: () => new Date('2026-04-15T07:00:00Z') },
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PostDetailClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetPostDetail.mockResolvedValue(mockPost);
    mockedGetLatestComments.mockResolvedValue(mockComments);
    mockedHasUserLikedPost.mockResolvedValue(false);
    mockedGetMoreComments.mockResolvedValue([]);
  });

  it('文章區域以 PostCard 呈現（article 語義元素）', async () => {
    render(<PostDetailClient postId="post-1" />);
    const articles = await screen.findAllByRole('article');
    expect(articles[0]).toBeInTheDocument();
  });

  it('顯示文章標題和完整內容', async () => {
    render(<PostDetailClient postId="post-1" />);
    expect(await screen.findByText('晨跑日記')).toBeInTheDocument();
    expect(screen.getByText('今天跑了十公里')).toBeInTheDocument();
  });

  it('留言以 CommentCard 呈現（每則留言各自為 article 語義元素）', async () => {
    render(<PostDetailClient postId="post-1" />);
    await screen.findByText('晨跑日記');
    // 文章本身 1 個 article + 留言 1 個 article = 至少 2 個
    const articles = screen.getAllByRole('article');
    expect(articles.length).toBeGreaterThanOrEqual(2);
  });

  it('顯示留言列表', async () => {
    render(<PostDetailClient postId="post-1" />);
    expect(await screen.findByText('跑得好！')).toBeInTheDocument();
  });

  it('按讚按鈕可點擊', async () => {
    const user = userEvent.setup();
    render(<PostDetailClient postId="post-1" />);
    await screen.findByText('晨跑日記');
    const likeButtons = screen.getAllByRole('button');
    const likeButton = likeButtons.find(
      (btn) => btn.querySelector('svg') && btn.textContent.includes('5'),
    );
    expect(likeButton).toBeDefined();
    await user.click(likeButton);
    expect(toggleLikePost).toHaveBeenCalledWith('post-1', 'user-1');
  });

  it('留言輸入後可送出', async () => {
    const user = userEvent.setup();
    mockedAddComment.mockResolvedValue({ id: 'new-comment' });
    mockedGetCommentById.mockResolvedValue({
      id: 'new-comment',
      authorUid: 'user-1',
      authorName: '小明',
      comment: '好棒',
      createdAt: { toDate: () => new Date() },
    });
    render(<PostDetailClient postId="post-1" />);
    await screen.findByText('晨跑日記');
    const input = screen.getByPlaceholderText(/留言/);
    await user.type(input, '好棒');
    await user.click(screen.getByRole('button', { name: /送出/ }));
    expect(addComment).toHaveBeenCalled();
  });
});
