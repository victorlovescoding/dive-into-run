import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Polyfills
// ---------------------------------------------------------------------------

// jsdom 缺少 matchMedia
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
// Mocks — firebase-client (prevent real Firebase init)
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
// Mocks — firebase-events
// ---------------------------------------------------------------------------

vi.mock('@/lib/firebase-events', () => ({
  fetchEventById: vi.fn(),
  fetchParticipants: vi.fn(),
  fetchMyJoinedEventsForIds: vi.fn(),
  joinEvent: vi.fn(),
  leaveEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — firebase-notifications
// ---------------------------------------------------------------------------

vi.mock('@/lib/firebase-notifications', () => ({
  notifyEventModified: vi.fn(),
  notifyEventCancelled: vi.fn(),
  notifyPostNewComment: vi.fn(),
  watchNotifications: vi.fn(() => vi.fn()),
  watchUnreadNotifications: vi.fn(() => vi.fn()),
  markNotificationAsRead: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — firebase-posts
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
// Mocks — event-helpers (partial, keep real utils)
// ---------------------------------------------------------------------------

vi.mock('@/lib/event-helpers', async (importOriginal) => {
  const actual = /** @type {Record<string, unknown>} */ (await importOriginal());
  return {
    ...actual,
    normalizeRoutePolylines: vi.fn(() => []),
  };
});

// ---------------------------------------------------------------------------
// Mocks — contexts
// ---------------------------------------------------------------------------

vi.mock('@/contexts/AuthContext', () => {
  const { createContext } = require('react');
  return {
    AuthContext: createContext({
      user: {
        uid: 'host1',
        name: 'Host User',
        email: null,
        photoURL: 'https://photo.url/host.jpg',
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
vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
  ToastContext: require('react').createContext({
    toasts: [],
    showToast: () => {},
    removeToast: () => {},
  }),
  default: ({ children }) => children,
}));

// ---------------------------------------------------------------------------
// Mocks — next
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
  usePathname: vi.fn(() => '/events/evt1'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

vi.mock('next/image', () => ({
  default: ({ fill: _fill, priority: _priority, ...rest }) =>
    require('react').createElement('img', rest),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  fetchEventById,
  fetchParticipants,
  fetchMyJoinedEventsForIds,
  updateEvent,
  deleteEvent,
} from '@/lib/firebase-events';
import {
  notifyEventModified,
  notifyEventCancelled,
  notifyPostNewComment,
} from '@/lib/firebase-notifications';
import {
  getPostDetail,
  addComment,
  getLatestComments,
  getCommentById,
  hasUserLikedPost,
} from '@/lib/firebase-posts';
import EventDetailClient from '@/app/events/[id]/eventDetailClient';
import PostDetailClient from '@/app/posts/[id]/PostDetailClient';

// cast to vi.Mock for convenience
const mockedFetchEventById = /** @type {import('vitest').Mock} */ (fetchEventById);
const mockedFetchParticipants = /** @type {import('vitest').Mock} */ (fetchParticipants);
const mockedFetchMyJoinedEventsForIds = /** @type {import('vitest').Mock} */ (
  fetchMyJoinedEventsForIds
);
const mockedUpdateEvent = /** @type {import('vitest').Mock} */ (updateEvent);
const mockedDeleteEvent = /** @type {import('vitest').Mock} */ (deleteEvent);

const mockedNotifyEventModified = /** @type {import('vitest').Mock} */ (notifyEventModified);
const mockedNotifyEventCancelled = /** @type {import('vitest').Mock} */ (notifyEventCancelled);
const mockedNotifyPostNewComment = /** @type {import('vitest').Mock} */ (notifyPostNewComment);

const mockedGetPostDetail = /** @type {import('vitest').Mock} */ (getPostDetail);
const mockedAddComment = /** @type {import('vitest').Mock} */ (addComment);
const mockedGetLatestComments = /** @type {import('vitest').Mock} */ (getLatestComments);
const mockedGetCommentById = /** @type {import('vitest').Mock} */ (getCommentById);
const mockedHasUserLikedPost = /** @type {import('vitest').Mock} */ (hasUserLikedPost);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 建立一個最小但完整的 mock 活動物件，hostUid 匹配 AuthContext mock user。
 * @param {object} overrides - 覆蓋預設值的欄位。
 * @returns {object} mock 活動物件。
 */
function buildMockEvent(overrides = {}) {
  return {
    id: 'evt1',
    title: '週末晨跑',
    time: '2099-12-27T07:00',
    registrationDeadline: '2099-12-26T23:59',
    city: '台北市',
    district: '大安區',
    meetPlace: '大安森林公園',
    distanceKm: 5,
    paceSec: 360,
    maxParticipants: 20,
    participantsCount: 2,
    remainingSeats: 18,
    hostUid: 'host1',
    hostName: 'Host User',
    hostPhotoURL: 'https://photo.url/host.jpg',
    description: '一起來跑步吧',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Event Detail — edit → notifyEventModified
// ---------------------------------------------------------------------------

describe('EventDetailClient notification triggers', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 預設 mock 回傳
    mockedFetchEventById.mockResolvedValue(buildMockEvent());
    mockedFetchParticipants.mockResolvedValue([
      { uid: 'p1', name: 'P1', photoURL: '' },
      { uid: 'p2', name: 'P2', photoURL: '' },
    ]);
    mockedFetchMyJoinedEventsForIds.mockResolvedValue(new Set());
    mockedUpdateEvent.mockResolvedValue(undefined);
    mockedDeleteEvent.mockResolvedValue(undefined);
    mockedNotifyEventModified.mockResolvedValue(undefined);
    mockedNotifyEventCancelled.mockResolvedValue(undefined);
  });

  it('calls notifyEventModified after successful edit', async () => {
    const user = userEvent.setup();
    render(<EventDetailClient id="evt1" />);

    // 等活動載入完成
    await waitFor(() => {
      expect(screen.getByText('週末晨跑')).toBeInTheDocument();
    });

    // 點開三點選單（EventCardMenu 的 button）
    const menuBtn = screen.getByRole('button', { name: '更多操作' });
    await user.click(menuBtn);

    // 點「編輯活動」
    const editBtn = screen.getByRole('menuitem', { name: '編輯活動' });
    await user.click(editBtn);

    // 等編輯表單出現
    await waitFor(() => {
      expect(screen.getByText('編輯活動')).toBeInTheDocument();
    });

    // 修改標題使 dirty=true，讓 submit button 可按
    const titleInput = screen.getByLabelText('活動名稱');
    await user.clear(titleInput);
    await user.type(titleInput, '修改後的晨跑');

    // 送出
    const submitBtn = screen.getByRole('button', { name: '編輯完成' });
    await user.click(submitBtn);

    // 驗證 updateEvent 被呼叫
    await waitFor(() => {
      expect(mockedUpdateEvent).toHaveBeenCalledWith(
        'evt1',
        expect.objectContaining({
          title: '修改後的晨跑',
        }),
      );
    });

    // 驗證 notifyEventModified 被呼叫，帶正確參數
    await waitFor(() => {
      expect(mockedNotifyEventModified).toHaveBeenCalledWith('evt1', '週末晨跑', {
        uid: 'host1',
        name: 'Host User',
        photoURL: 'https://photo.url/host.jpg',
      });
    });
  });

  it('calls notifyEventCancelled then deleteEvent on delete confirm', async () => {
    const user = userEvent.setup();
    render(<EventDetailClient id="evt1" />);

    // 等活動載入完成
    await waitFor(() => {
      expect(screen.getByText('週末晨跑')).toBeInTheDocument();
    });

    // 點開三點選單
    const menuBtn = screen.getByRole('button', { name: '更多操作' });
    await user.click(menuBtn);

    // 點「刪除活動」
    const deleteBtn = screen.getByRole('menuitem', { name: '刪除活動' });
    await user.click(deleteBtn);

    // 等刪除確認對話框出現
    await waitFor(() => {
      expect(screen.getByText('確定要刪除活動？')).toBeInTheDocument();
    });

    // 點「是，確認刪除」
    const confirmBtn = screen.getByRole('button', { name: '是，確認刪除' });
    await user.click(confirmBtn);

    // 驗證 notifyEventCancelled 被呼叫（內部會先 fetchParticipants 再通知）
    await waitFor(() => {
      expect(mockedNotifyEventCancelled).toHaveBeenCalledWith(
        'evt1',
        '週末晨跑',
        expect.arrayContaining([
          expect.objectContaining({ uid: 'p1' }),
          expect.objectContaining({ uid: 'p2' }),
        ]),
        {
          uid: 'host1',
          name: 'Host User',
          photoURL: 'https://photo.url/host.jpg',
        },
      );
    });

    // 驗證 deleteEvent 被呼叫
    await waitFor(() => {
      expect(mockedDeleteEvent).toHaveBeenCalledWith('evt1');
    });
  });
});

// ---------------------------------------------------------------------------
// Post Detail — add comment → notifyPostNewComment
// ---------------------------------------------------------------------------

describe('PostDetailClient notification triggers', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedGetLatestComments.mockResolvedValue([]);
    mockedHasUserLikedPost.mockResolvedValue(false);
    mockedAddComment.mockResolvedValue({ id: 'cmt1' });
    mockedGetCommentById.mockResolvedValue({
      id: 'cmt1',
      authorUid: 'host1',
      authorName: 'Host User',
      authorImgURL: 'https://photo.url/host.jpg',
      comment: '好文！',
      createdAt: new Date(),
    });
    mockedNotifyPostNewComment.mockResolvedValue(undefined);
  });

  it('calls notifyPostNewComment when commenter is not the post author', async () => {
    // post 的作者是 author99，登入使用者是 host1 → 不同人 → 應通知
    mockedGetPostDetail.mockResolvedValue({
      id: 'post1',
      title: '跑步心得',
      content: '今天跑了 10K',
      authorUid: 'author99',
      authorName: 'Author',
      authorImgURL: '',
      likesCount: 0,
      commentsCount: 0,
    });

    const user = userEvent.setup();
    render(<PostDetailClient postId="post1" />);

    // 等文章載入
    await waitFor(() => {
      expect(screen.getByText('跑步心得')).toBeInTheDocument();
    });

    // 輸入留言
    const commentInput = screen.getByRole('textbox', { name: '留言' });
    await user.type(commentInput, '好文！');

    // 送出
    const submitBtn = screen.getByRole('button', { name: '送出' });
    await user.click(submitBtn);

    // 驗證 addComment 被呼叫
    await waitFor(() => {
      expect(mockedAddComment).toHaveBeenCalledWith(
        'post1',
        expect.objectContaining({
          comment: '好文！',
        }),
      );
    });

    // 驗證 notifyPostNewComment 被呼叫
    await waitFor(() => {
      expect(mockedNotifyPostNewComment).toHaveBeenCalledWith(
        'post1',
        '跑步心得',
        'author99',
        'cmt1',
        {
          uid: 'host1',
          name: 'Host User',
          photoURL: 'https://photo.url/host.jpg',
        },
      );
    });
  });

  it('does NOT call notifyPostNewComment when commenter is the post author', async () => {
    // post 的作者是 host1，登入使用者也是 host1 → 同一人 → 不通知
    mockedGetPostDetail.mockResolvedValue({
      id: 'post2',
      title: '我的文章',
      content: '自己的文章',
      authorUid: 'host1',
      authorName: 'Host User',
      authorImgURL: 'https://photo.url/host.jpg',
      likesCount: 0,
      commentsCount: 0,
    });

    const user = userEvent.setup();
    render(<PostDetailClient postId="post2" />);

    // 等文章載入
    await waitFor(() => {
      expect(screen.getByText('我的文章')).toBeInTheDocument();
    });

    // 輸入留言
    const commentInput = screen.getByRole('textbox', { name: '留言' });
    await user.type(commentInput, '自己留言');

    // 送出
    const submitBtn = screen.getByRole('button', { name: '送出' });
    await user.click(submitBtn);

    // 驗證 addComment 被呼叫
    await waitFor(() => {
      expect(mockedAddComment).toHaveBeenCalled();
    });

    // 驗證 notifyPostNewComment「沒有」被呼叫
    expect(mockedNotifyPostNewComment).not.toHaveBeenCalled();
  });
});
