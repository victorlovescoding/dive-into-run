import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/firebase-notifications', () => ({
  watchNotifications: vi.fn(),
  watchUnreadNotifications: vi.fn(),
  markNotificationAsRead: vi.fn(),
  fetchMoreNotifications: vi.fn(),
  fetchMoreUnreadNotifications: vi.fn(),
}));

vi.mock('@/lib/notification-helpers', () => ({
  formatRelativeTime: vi.fn(() => '5 分鐘前'),
  getNotificationLink: vi.fn(() => '/events/test'),
}));

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    const { src, alt, width, height, ...rest } = props;
    return <img src={src} alt={alt} width={width} height={height} {...rest} />;
  },
}));

vi.mock('@/contexts/AuthContext', () => {
  const { createContext } = require('react');
  /** @type {import('react').Context<import('@/contexts/AuthContext').AuthContextValue>} */
  const AuthContext = createContext({
    user: null,
    setUser: () => {},
    loading: false,
  });
  return {
    AuthContext,
    default: ({ children }) => children,
  };
});

import {
  watchNotifications,
  watchUnreadNotifications,
  fetchMoreNotifications,
} from '@/lib/firebase-notifications';
import { AuthContext } from '@/contexts/AuthContext';
import NotificationProvider from '@/contexts/NotificationContext';
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

/**
 * 建立測試用通知資料。
 * @param {string} id - 通知 ID。
 * @param {boolean} [read] - 是否已讀，預設 false。
 * @returns {import('@/lib/notification-helpers').NotificationItem} 測試用通知。
 */
function createNotification(id, read = false) {
  return /** @type {import('@/lib/notification-helpers').NotificationItem} */ ({
    id,
    recipientUid: 'user1',
    type: 'event_modified',
    actorUid: 'actor1',
    actorName: 'Actor',
    actorPhotoURL: 'https://example.com/photo.jpg',
    entityType: 'event',
    entityId: 'evt1',
    entityTitle: '跑步',
    commentId: null,
    message: `通知 ${id}`,
    read,
    createdAt: { toDate: () => new Date() },
  });
}

/**
 * 建立指定數量的通知陣列。
 * @param {number} count - 通知數量。
 * @param {number} [startIndex] - 起始索引，預設 1。
 * @returns {import('@/lib/notification-helpers').NotificationItem[]} 通知陣列。
 */
function createNotifications(count, startIndex = 1) {
  return Array.from({ length: count }, (_, i) => createNotification(`n${startIndex + i}`));
}

/** @type {((items: import('@/lib/notification-helpers').NotificationItem[], lastDoc?: unknown) => void) | undefined} */
let notificationsCallback;
/** @type {((items: import('@/lib/notification-helpers').NotificationItem[]) => void) | undefined} */
let unreadCallback;
const mockUnsubscribe = vi.fn();

const mockLastDoc = { id: 'last-doc-cursor' };
const mockNewLastDoc = { id: 'new-last-doc-cursor' };

/** @type {((entries: IntersectionObserverEntry[]) => void) | undefined} */
let intersectionCallback;

beforeEach(() => {
  vi.clearAllMocks();
  notificationsCallback = undefined;
  unreadCallback = undefined;
  intersectionCallback = undefined;

  /** @type {import('vitest').Mock} */ (watchNotifications).mockImplementation((uid, onNext) => {
    notificationsCallback = onNext;
    return mockUnsubscribe;
  });
  /** @type {import('vitest').Mock} */ (watchUnreadNotifications).mockImplementation(
    (uid, onNext) => {
      unreadCallback = onNext;
      return mockUnsubscribe;
    },
  );

  global.IntersectionObserver = /** @type {typeof IntersectionObserver} */ (
    /** @type {unknown} */ (
      vi.fn(function MockIntersectionObserver(callback) {
        intersectionCallback = callback;
        this.observe = vi.fn();
        this.disconnect = vi.fn();
        this.unobserve = vi.fn();
      })
    )
  );
});

/**
 * 渲染完整通知面板（含 Bell + Panel + Provider）。
 * @returns {import('@testing-library/react').RenderResult} render 結果。
 */
function renderPanel() {
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
// NotificationPagination
// ===========================================================================

describe('NotificationPagination', () => {
  it('should show "查看先前通知" button when exactly 5 notifications', async () => {
    // Arrange
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: '通知' }));

    // Act — deliver exactly PAGE_SIZE (5) notifications
    act(() => {
      notificationsCallback?.(createNotifications(5), mockLastDoc);
      unreadCallback?.([]);
    });

    // Assert
    expect(screen.getByRole('button', { name: '查看先前通知' })).toBeInTheDocument();
  });

  it('should hide "查看先前通知" button when fewer than 5 notifications', async () => {
    // Arrange
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: '通知' }));

    // Act — deliver only 3 notifications
    act(() => {
      notificationsCallback?.(createNotifications(3), mockLastDoc);
      unreadCallback?.([]);
    });

    // Assert
    expect(screen.queryByRole('button', { name: '查看先前通知' })).not.toBeInTheDocument();
  });

  it('should load more notifications when clicking "查看先前通知"', async () => {
    // Arrange
    const user = userEvent.setup();
    const moreNotifications = createNotifications(5, 6);

    /** @type {import('vitest').Mock} */ (fetchMoreNotifications).mockResolvedValueOnce({
      notifications: moreNotifications,
      lastDoc: mockNewLastDoc,
    });

    renderPanel();
    await user.click(screen.getByRole('button', { name: '通知' }));

    act(() => {
      notificationsCallback?.(createNotifications(5), mockLastDoc);
      unreadCallback?.([]);
    });

    // Act — click load more button
    await user.click(screen.getByRole('button', { name: '查看先前通知' }));

    // Assert — fetchMoreNotifications called with correct args
    expect(fetchMoreNotifications).toHaveBeenCalledWith('user1', mockLastDoc, 5);

    // Assert — all 10 notifications visible
    await waitFor(() => {
      for (let i = 1; i <= 10; i++) {
        expect(screen.getByText(`通知 n${i}`)).toBeInTheDocument();
      }
    });
  });

  it('should activate infinite scroll sentinel after first loadMore', async () => {
    // Arrange
    const user = userEvent.setup();
    const moreNotifications = createNotifications(5, 6);

    /** @type {import('vitest').Mock} */ (fetchMoreNotifications).mockResolvedValueOnce({
      notifications: moreNotifications,
      lastDoc: mockNewLastDoc,
    });

    renderPanel();
    await user.click(screen.getByRole('button', { name: '通知' }));

    act(() => {
      notificationsCallback?.(createNotifications(5), mockLastDoc);
      unreadCallback?.([]);
    });

    // Act — click load more to transition to infinite scroll
    await user.click(screen.getByRole('button', { name: '查看先前通知' }));

    // Assert — after loading, IntersectionObserver should be set up
    await waitFor(() => {
      expect(global.IntersectionObserver).toHaveBeenCalled();
    });

    // Assert — "查看先前通知" button should be hidden after first load
    expect(screen.queryByRole('button', { name: '查看先前通知' })).not.toBeInTheDocument();
  });

  it('should stop loading when fetchMoreNotifications returns fewer than 5', async () => {
    // Arrange
    const user = userEvent.setup();

    // First load more returns exactly 5
    /** @type {import('vitest').Mock} */ (fetchMoreNotifications).mockResolvedValueOnce({
      notifications: createNotifications(5, 6),
      lastDoc: mockNewLastDoc,
    });

    renderPanel();
    await user.click(screen.getByRole('button', { name: '通知' }));

    act(() => {
      notificationsCallback?.(createNotifications(5), mockLastDoc);
      unreadCallback?.([]);
    });

    // First load more — returns 5, hasMore still true
    await user.click(screen.getByRole('button', { name: '查看先前通知' }));

    await waitFor(() => {
      expect(screen.getByText('通知 n10')).toBeInTheDocument();
    });

    // Second load more via IntersectionObserver — returns < 5
    /** @type {import('vitest').Mock} */ (fetchMoreNotifications).mockResolvedValueOnce({
      notifications: createNotifications(2, 11),
      lastDoc: null,
    });

    // Trigger intersection
    await act(async () => {
      intersectionCallback?.(
        /** @type {IntersectionObserverEntry[]} */ ([{ isIntersecting: true }]),
      );
    });

    // Assert — all 12 notifications visible
    await waitFor(() => {
      expect(screen.getByText('通知 n12')).toBeInTheDocument();
    });

    // Assert — no more sentinel or button since hasMore is false
    expect(screen.queryByRole('button', { name: '查看先前通知' })).not.toBeInTheDocument();

    // IntersectionObserver should not trigger further loads
    const callCountAfter = /** @type {import('vitest').Mock} */ (fetchMoreNotifications).mock.calls
      .length;
    expect(callCountAfter).toBe(2);
  });
});
