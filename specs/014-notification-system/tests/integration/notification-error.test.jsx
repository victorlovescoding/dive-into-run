import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
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
// Mocks — firebase-client
// ---------------------------------------------------------------------------

vi.mock('@/config/client/firebase-client', () => ({
  auth: {},
  db: {},
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

vi.mock('@/lib/firebase-users', () => ({
  loginCheckUserData: vi.fn(),
  watchUserProfile: vi.fn(),
}));

vi.mock('@/runtime/client/use-cases/auth-use-cases', () => ({
  default: vi.fn(() => vi.fn()),
}));

vi.mock('@/runtime/client/use-cases/notification-use-cases', () => ({
  watchNotifications: vi.fn(),
  watchUnreadNotifications: vi.fn(),
  markNotificationAsRead: vi.fn(),
  fetchMoreNotifications: vi.fn(),
  fetchMoreUnreadNotifications: vi.fn(),
  notifyEventModified: vi.fn().mockResolvedValue(undefined),
  notifyEventCancelled: vi.fn().mockResolvedValue(undefined),
  notifyPostNewComment: vi.fn().mockResolvedValue(undefined),
  notifyPostCommentReply: vi.fn().mockResolvedValue(undefined),
  notifyEventNewComment: vi.fn().mockResolvedValue(undefined),
  fetchDistinctCommentAuthors: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Mocks — firebase-events
// ---------------------------------------------------------------------------

vi.mock('@/runtime/client/use-cases/event-use-cases', () => ({
  fetchEventById: vi.fn(),
  fetchParticipants: vi.fn(),
  fetchMyJoinedEventsForIds: vi.fn(),
  joinEvent: vi.fn(),
  leaveEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
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
// Mocks — event-helpers
// ---------------------------------------------------------------------------

vi.mock('@/lib/event-helpers', async (importOriginal) => {
  const actual = /** @type {Record<string, unknown>} */ (await importOriginal());
  return {
    ...actual,
    normalizeRoutePolylines: vi.fn(() => []),
  };
});

// ---------------------------------------------------------------------------
// Mocks — next
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
  usePathname: vi.fn(() => '/'),
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
  watchNotifications,
  watchUnreadNotifications,
  notifyEventModified,
  notifyPostNewComment,
} from '@/runtime/client/use-cases/notification-use-cases';
import {
  fetchEventById,
  fetchParticipants,
  fetchMyJoinedEventsForIds,
  updateEvent,
} from '@/runtime/client/use-cases/event-use-cases';
import {
  getPostDetail,
  addComment,
  getLatestComments,
  getCommentById,
  hasUserLikedPost,
} from '@/lib/firebase-posts';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { ToastContext } from '@/runtime/providers/ToastProvider';
import NotificationProvider from '@/runtime/providers/NotificationProvider';
import EventDetailClient from '@/app/events/[id]/eventDetailClient';
import PostDetailClient from '@/app/posts/[id]/PostDetailClient';

// ---------------------------------------------------------------------------
// Cast mocks
// ---------------------------------------------------------------------------

const mockedWatchNotifications = /** @type {import('vitest').Mock} */ (watchNotifications);
const mockedWatchUnreadNotifications = /** @type {import('vitest').Mock} */ (
  watchUnreadNotifications
);
const mockedNotifyEventModified = /** @type {import('vitest').Mock} */ (notifyEventModified);
const mockedNotifyPostNewComment = /** @type {import('vitest').Mock} */ (notifyPostNewComment);
const mockedFetchEventById = /** @type {import('vitest').Mock} */ (fetchEventById);
const mockedFetchParticipants = /** @type {import('vitest').Mock} */ (fetchParticipants);
const mockedFetchMyJoinedEventsForIds = /** @type {import('vitest').Mock} */ (
  fetchMyJoinedEventsForIds
);
const mockedUpdateEvent = /** @type {import('vitest').Mock} */ (updateEvent);
const mockedGetPostDetail = /** @type {import('vitest').Mock} */ (getPostDetail);
const mockedAddComment = /** @type {import('vitest').Mock} */ (addComment);
const mockedGetLatestComments = /** @type {import('vitest').Mock} */ (getLatestComments);
const mockedGetCommentById = /** @type {import('vitest').Mock} */ (getCommentById);
const mockedHasUserLikedPost = /** @type {import('vitest').Mock} */ (hasUserLikedPost);

// ---------------------------------------------------------------------------
// Shared data
// ---------------------------------------------------------------------------

const mockUser = {
  uid: 'host1',
  name: 'Host User',
  email: null,
  photoURL: 'https://photo.url/host.jpg',
  bio: null,
  getIdToken: async () => '',
};

const mockShowToast = vi.fn();

// ---------------------------------------------------------------------------
// Test 1: NotificationContext onError → showToast via ToastContext
// ---------------------------------------------------------------------------

describe('NotificationContext onError → ToastContext', () => {
  /** @type {(err: Error) => void} */
  let unreadOnError;
  /** @type {(err: Error) => void} */
  let allOnError;
  const mockUnsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockedWatchUnreadNotifications.mockImplementation((uid, onNext, onError) => {
      onNext([]);
      unreadOnError = onError;
      return mockUnsubscribe;
    });

    mockedWatchNotifications.mockImplementation((uid, onNext, onError, _onNew) => {
      onNext([], null);
      allOnError = onError;
      return mockUnsubscribe;
    });
  });

  /**
   * 渲染 NotificationProvider，包裹在 AuthContext + ToastContext 內。
   * @returns {import('@testing-library/react').RenderResult} render 結果。
   */
  function renderWithProviders() {
    return render(
      <AuthContext.Provider value={{ user: mockUser, setUser: () => {}, loading: false }}>
        <ToastContext.Provider
          value={{ toasts: [], showToast: mockShowToast, removeToast: vi.fn() }}
        >
          <NotificationProvider>
            <div>test child</div>
          </NotificationProvider>
        </ToastContext.Provider>
      </AuthContext.Provider>,
    );
  }

  it('watchUnreadNotifications onError → 透過 ToastContext 顯示錯誤 toast', () => {
    renderWithProviders();

    act(() => {
      unreadOnError(new Error('Firestore permission denied'));
    });

    expect(mockShowToast).toHaveBeenCalledWith('通知載入失敗', 'error');
  });

  it('watchNotifications onError → 透過 ToastContext 顯示錯誤 toast', () => {
    renderWithProviders();

    act(() => {
      allOnError(new Error('Firestore quota exceeded'));
    });

    expect(mockShowToast).toHaveBeenCalledWith('通知載入失敗', 'error');
  });
});

// ---------------------------------------------------------------------------
// Test 2: EventDetailClient — notifyEventModified failure → error toast
// ---------------------------------------------------------------------------

describe('EventDetailClient notification error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedFetchEventById.mockResolvedValue({
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
    });
    mockedFetchParticipants.mockResolvedValue([{ uid: 'p1', name: 'P1', photoURL: '' }]);
    mockedFetchMyJoinedEventsForIds.mockResolvedValue(new Set());
    mockedUpdateEvent.mockResolvedValue(undefined);
    mockedNotifyEventModified.mockRejectedValue(new Error('Network error'));
  });

  /**
   * 渲染 EventDetailClient 搭配 mock AuthContext + ToastContext。
   * @returns {import('@testing-library/react').RenderResult} render 結果。
   */
  function renderEventDetail() {
    return render(
      <AuthContext.Provider value={{ user: mockUser, setUser: () => {}, loading: false }}>
        <ToastContext.Provider
          value={{ toasts: [], showToast: mockShowToast, removeToast: vi.fn() }}
        >
          <EventDetailClient id="evt1" />
        </ToastContext.Provider>
      </AuthContext.Provider>,
    );
  }

  it('notifyEventModified 失敗時顯示錯誤 toast 而非 crash', async () => {
    const user = userEvent.setup();
    renderEventDetail();

    // 等活動載入
    await waitFor(() => {
      expect(screen.getByText('週末晨跑')).toBeInTheDocument();
    });

    // 點開三點選單
    const menuBtn = screen.getByRole('button', { name: '更多操作' });
    await user.click(menuBtn);

    // 點「編輯活動」
    const editBtn = screen.getByRole('menuitem', { name: '編輯活動' });
    await user.click(editBtn);

    // 等編輯表單出現
    await waitFor(() => {
      expect(screen.getByText('編輯活動')).toBeInTheDocument();
    });

    // 修改標題
    const titleInput = screen.getByLabelText('活動名稱');
    await user.clear(titleInput);
    await user.type(titleInput, '修改後的晨跑');

    // 送出
    const submitBtn = screen.getByRole('button', { name: '編輯完成' });
    await user.click(submitBtn);

    // updateEvent 成功
    await waitFor(() => {
      expect(mockedUpdateEvent).toHaveBeenCalled();
    });

    // notifyEventModified 被呼叫但會 reject
    await waitFor(() => {
      expect(mockedNotifyEventModified).toHaveBeenCalled();
    });

    // 應該顯示通知發送失敗的 toast
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('通知發送失敗', 'error');
    });
  });
});

// ---------------------------------------------------------------------------
// Test 3: PostDetailClient — notifyPostNewComment failure → error toast
// ---------------------------------------------------------------------------

describe('PostDetailClient notification error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
    mockedNotifyPostNewComment.mockRejectedValue(new Error('Firestore write failed'));
  });

  /**
   * 渲染 PostDetailClient 搭配 mock AuthContext + ToastContext。
   * @returns {import('@testing-library/react').RenderResult} render 結果。
   */
  function renderPostDetail() {
    return render(
      <AuthContext.Provider value={{ user: mockUser, setUser: () => {}, loading: false }}>
        <ToastContext.Provider
          value={{ toasts: [], showToast: mockShowToast, removeToast: vi.fn() }}
        >
          <PostDetailClient postId="post1" />
        </ToastContext.Provider>
      </AuthContext.Provider>,
    );
  }

  it('notifyPostNewComment 失敗時顯示錯誤 toast 而非 crash', async () => {
    const user = userEvent.setup();
    renderPostDetail();

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

    // addComment 被呼叫
    await waitFor(() => {
      expect(mockedAddComment).toHaveBeenCalled();
    });

    // notifyPostNewComment 被呼叫但會 reject
    await waitFor(() => {
      expect(mockedNotifyPostNewComment).toHaveBeenCalled();
    });

    // 應該顯示通知發送失敗的 toast
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('通知發送失敗', 'error');
    });
  });
});
