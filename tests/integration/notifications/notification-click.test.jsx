import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/runtime/client/use-cases/auth-use-cases', () => ({
  default: vi.fn(() => vi.fn()),
}));

vi.mock('@/runtime/client/use-cases/notification-use-cases', () => ({
  watchNotifications: vi.fn(),
  watchUnreadNotifications: vi.fn(),
  markNotificationAsRead: vi.fn(),
  fetchMoreNotifications: vi.fn(),
  fetchMoreUnreadNotifications: vi.fn(),
}));

vi.mock('@/lib/notification-helpers', () => ({
  formatRelativeTime: vi.fn(() => '5 分鐘前'),
  getNotificationLink: vi.fn((n) => {
    if (n.type === 'post_new_comment') return `/posts/${n.entityId}?commentId=${n.commentId}`;
    return `/events/${n.entityId}`;
  }),
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({ push: mockPush })),
}));

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    const { src, alt, width, height, ...rest } = props;
    return <img src={src} alt={alt} width={width} height={height} {...rest} />;
  },
}));

import {
  watchNotifications,
  watchUnreadNotifications,
  markNotificationAsRead,
} from '@/runtime/client/use-cases/notification-use-cases';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import NotificationProvider from '@/runtime/providers/NotificationProvider';
import NotificationPanel from '@/components/Notifications/NotificationPanel';
import NotificationBell from '@/components/Notifications/NotificationBell';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUser = {
  uid: 'user1',
  name: 'Test',
  email: null,
  photoURL: null,
  bio: null,
  getIdToken: async () => '',
};

/** @type {((notifications: any[]) => void) | undefined} */
let notificationsCallback;
/** @type {((notifications: any[]) => void) | undefined} */
let unreadCallback;
const mockUnsubscribe = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  notificationsCallback = undefined;
  unreadCallback = undefined;

  const mockedWatch = /** @type {import('vitest').Mock} */ (watchNotifications);
  const mockedWatchUnread = /** @type {import('vitest').Mock} */ (watchUnreadNotifications);

  mockedWatch.mockImplementation((uid, onNext) => {
    notificationsCallback = onNext;
    return mockUnsubscribe;
  });
  mockedWatchUnread.mockImplementation((uid, onNext) => {
    unreadCallback = onNext;
    return mockUnsubscribe;
  });
});

/**
 * 建立測試用通知資料。
 * @param {Partial<import('@/lib/notification-helpers').NotificationItem>} [overrides] - 覆寫欄位。
 * @returns {import('@/lib/notification-helpers').NotificationItem} 測試用通知。
 */
function createMockNotification(overrides = {}) {
  return /** @type {import('@/lib/notification-helpers').NotificationItem} */ ({
    id: 'n1',
    recipientUid: 'user1',
    type: 'event_modified',
    actorUid: 'actor1',
    actorName: 'Test Actor',
    actorPhotoURL: '',
    entityType: 'event',
    entityId: 'evt1',
    entityTitle: '週末跑步',
    commentId: null,
    message: '你所參加的『週末跑步』活動資訊有更動',
    read: false,
    createdAt: /** @type {any} */ (new Date()),
    ...overrides,
  });
}

/**
 * 渲染 Bell + Panel（模擬 Navbar 整合場景）。
 * @returns {import('@testing-library/react').RenderResult} render 結果。
 */
function renderWithProviders() {
  return render(
    <AuthContext.Provider value={{ user: mockUser, setUser: () => {}, loading: false }}>
      <NotificationProvider>
        <NotificationBell />
        <NotificationPanel />
      </NotificationProvider>
    </AuthContext.Provider>,
  );
}

// ===========================================================================
// Notification Click Behavior
// ===========================================================================

describe('Notification click behavior', () => {
  it('should markAsRead + navigate + close panel on event_modified click', async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders();

    const notification = createMockNotification({
      id: 'n-evt',
      type: 'event_modified',
      entityId: 'evt1',
    });

    // Open panel
    await user.click(screen.getByRole('button', { name: /通知/ }));

    // Push notifications into context
    act(() => {
      notificationsCallback?.([notification]);
      unreadCallback?.([notification]);
    });

    // Act — click the notification item
    await user.click(screen.getByRole('button', { name: /週末跑步/ }));

    // Assert
    expect(markNotificationAsRead).toHaveBeenCalledWith('n-evt');
    expect(mockPush).toHaveBeenCalledWith('/events/evt1');
    expect(screen.queryByRole('region', { name: '通知面板' })).not.toBeInTheDocument();
  });

  it('should navigate to post URL with commentId on post_new_comment click', async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders();

    const notification = createMockNotification({
      id: 'n-post',
      type: 'post_new_comment',
      entityType: 'post',
      entityId: 'post1',
      commentId: 'cmt1',
      message: '你的文章有一則新的留言',
    });

    await user.click(screen.getByRole('button', { name: /通知/ }));

    act(() => {
      notificationsCallback?.([notification]);
      unreadCallback?.([notification]);
    });

    // Act
    await user.click(screen.getByRole('button', { name: /新的留言/ }));

    // Assert
    expect(markNotificationAsRead).toHaveBeenCalledWith('n-post');
    expect(mockPush).toHaveBeenCalledWith('/posts/post1?commentId=cmt1');
  });

  it('should decrement badge count after marking as read', async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders();

    const notifications = [
      createMockNotification({ id: 'n1', message: '通知一' }),
      createMockNotification({ id: 'n2', message: '通知二' }),
      createMockNotification({ id: 'n3', message: '通知三' }),
    ];

    act(() => {
      notificationsCallback?.(notifications);
      unreadCallback?.(notifications);
    });

    // Badge should show 3
    expect(screen.getByText('3')).toBeInTheDocument();

    // Open panel + click first notification
    await user.click(screen.getByRole('button', { name: /通知/ }));
    await user.click(screen.getByRole('button', { name: /通知一/ }));

    // Simulate unreadCallback update (as if Firestore responded)
    act(() => {
      unreadCallback?.(notifications.slice(1));
    });

    // Badge should show 2
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should immediately hide blue dot after click (optimistic update)', async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders();

    const notification = createMockNotification({ id: 'n-opt', read: false });

    await user.click(screen.getByRole('button', { name: /通知/ }));

    act(() => {
      notificationsCallback?.([notification]);
      unreadCallback?.([notification]);
    });

    // Verify unread dot exists before click
    const panel = screen.getByRole('region', { name: '通知面板' });
    expect(within(panel).getByTestId('notification-unread-dot')).toBeInTheDocument();

    // Act — click the notification (panel closes, re-open to inspect)
    await user.click(screen.getByRole('button', { name: /週末跑步/ }));

    // Panel closed; re-open to check optimistic update
    await user.click(screen.getByRole('button', { name: /通知/ }));

    // The notification should now be marked as read — no blue dot
    const reopenedPanel = screen.getByRole('region', { name: '通知面板' });
    expect(within(reopenedPanel).queryByTestId('notification-unread-dot')).not.toBeInTheDocument();
  });
});
