import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
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

import { AuthContext } from '@/runtime/providers/AuthProvider';
import NotificationProvider, { useNotificationContext } from '@/runtime/providers/NotificationProvider';
import NotificationPanel from '@/components/Notifications/NotificationPanel';
import NotificationBell from '@/components/Notifications/NotificationBell';
import {
  fetchMoreNotifications,
  fetchMoreUnreadNotifications,
  watchNotifications,
  watchUnreadNotifications,
} from '@/runtime/client/use-cases/notification-use-cases';

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
 * 建立測試用通知資料，createdAt 依 index 遞減（index 大 = 最新）。
 * @param {string} id - 通知 ID。
 * @param {number} index - 排序索引（越大越新）。
 * @param {boolean} [read] - 是否已讀，預設 false。
 * @returns {import('@/lib/notification-helpers').NotificationItem} 測試用通知。
 */
function createNotification(id, index, read = false) {
  const ms = index * 1000;
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
    createdAt: { toDate: () => new Date(ms), toMillis: () => ms },
  });
}

/**
 * 建立 stateful pagination mock，模擬 Firestore cursor 行為。
 * @param {import('@/lib/notification-helpers').NotificationItem[]} allNotifications - 完整 dataset，已依 createdAt desc 排序。
 * @param {number} listenerLimit - listener 回傳筆數。
 * @returns {{ fireAllListener: () => void, fireUnreadListener: (items: any[]) => void, fireAllListenerWith: (items: any[]) => void }} mock 控制器。
 */
function setupStatefulMocks(allNotifications, listenerLimit = 5) {
  /** @type {((items: import('@/lib/notification-helpers').NotificationItem[], lastDoc?: unknown) => void) | undefined} */
  let notificationsOnNext;
  /** @type {((items: import('@/lib/notification-helpers').NotificationItem[], lastDoc?: unknown) => void) | undefined} */
  let unreadOnNext;

  /** @type {import('vitest').Mock} */ (watchNotifications).mockImplementation((uid, onNext) => {
    notificationsOnNext = onNext;
    return vi.fn();
  });

  /** @type {import('vitest').Mock} */ (watchUnreadNotifications).mockImplementation(
    (uid, onNext) => {
      unreadOnNext = onNext;
      return vi.fn();
    },
  );

  /** @type {import('vitest').Mock} */ (fetchMoreNotifications).mockImplementation(
    (uid, afterDoc, limitCount) => {
      const startIdx = afterDoc._index + 1;
      const page = allNotifications.slice(startIdx, startIdx + limitCount);
      const newLastDoc =
        page.length > 0
          ? { _index: startIdx + page.length - 1, id: page[page.length - 1].id }
          : null;
      return Promise.resolve({ notifications: page, lastDoc: newLastDoc });
    },
  );

  /** @type {import('vitest').Mock} */ (fetchMoreUnreadNotifications).mockImplementation(
    (uid, afterDoc, limitCount) => {
      const startIdx = afterDoc._index + 1;
      const unreadItems = allNotifications.filter((n) => !n.read);
      const page = unreadItems.slice(startIdx, startIdx + limitCount);
      const newLastDoc =
        page.length > 0
          ? { _index: startIdx + page.length - 1, id: page[page.length - 1].id }
          : null;
      return Promise.resolve({ notifications: page, lastDoc: newLastDoc });
    },
  );

  return {
    /** 觸發 listener 回傳前 listenerLimit 筆資料。 */
    fireAllListener: () => {
      const items = allNotifications.slice(0, listenerLimit);
      const lastDoc =
        items.length > 0 ? { _index: items.length - 1, id: items[items.length - 1].id } : null;
      notificationsOnNext?.(items, lastDoc);
    },
    /**
     * 觸發 unread listener 回傳指定筆數。
     * @param {import('@/lib/notification-helpers').NotificationItem[]} items - 未讀通知。
     */
    fireUnreadListener: (items) => {
      const lastDoc =
        items.length > 0 ? { _index: items.length - 1, id: items[items.length - 1].id } : null;
      unreadOnNext?.(items, lastDoc);
    },
    /**
     * 用自訂資料觸發 all listener（模擬新通知到達）。
     * @param {import('@/lib/notification-helpers').NotificationItem[]} items - 新資料。
     */
    fireAllListenerWith: (items) => {
      const lastDoc =
        items.length > 0 ? { _index: items.length - 1, id: items[items.length - 1].id } : null;
      notificationsOnNext?.(items, lastDoc);
    },
  };
}

/** @type {((entries: IntersectionObserverEntry[]) => void) | undefined} */
let intersectionCallback;
/** @type {import('@/runtime/providers/notification-context').NotificationContextValue | undefined} */
let latestNotificationContext;

beforeEach(() => {
  vi.clearAllMocks();
  intersectionCallback = undefined;
  latestNotificationContext = undefined;

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
 * Captures the real NotificationProvider context value for direct runtime assertions.
 * @returns {null} This component does not render visible UI.
 */
function NotificationContextProbe() {
  const context = useNotificationContext();

  useEffect(() => {
    latestNotificationContext = context;
  }, [context]);

  return null;
}

/**
 * 取得目前最新的 NotificationProvider context。
 * @returns {import('@/runtime/providers/notification-context').NotificationContextValue} context value。
 */
function getNotificationContext() {
  if (!latestNotificationContext) {
    throw new Error('NotificationContextProbe has not rendered');
  }
  return latestNotificationContext;
}

/**
 * 使用 Provider 的 loadMore 邏輯把 unread listener slice 從 5 推進到 100。
 * 這保留 production 的 +5 狀態轉移，但避開 19 次完整 pointer/click simulation。
 * @returns {Promise<void>}
 */
async function expandUnreadSliceToListenerCapacity() {
  await act(async () => {
    for (let i = 0; i < 19; i += 1) {
      await getNotificationContext().loadMore();
    }
  });
}

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
        <NotificationContextProbe />
      </NotificationProvider>
    </AuthContext.Provider>,
  );
}

// ===========================================================================
// Stateful Pagination Tests
// ===========================================================================

describe('NotificationPagination — stateful cursor tests', () => {
  it('should traverse all pages without gaps or duplicates (all tab)', async () => {
    // 13 notifications: n13(newest) → n1(oldest)
    const all = Array.from({ length: 13 }, (_, i) => {
      const idx = 13 - i;
      return createNotification(`n${idx}`, idx);
    });

    const { fireAllListener, fireUnreadListener } = setupStatefulMocks(all);
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: '通知' }));

    // Initial listener: n13..n9 (5 items)
    act(() => {
      fireAllListener();
      fireUnreadListener([]);
    });

    expect(screen.getAllByText(/^通知 n\d+$/)).toHaveLength(5);

    // Load more #1: n8..n4 (5 items)
    await user.click(screen.getByRole('button', { name: '查看先前通知' }));
    await waitFor(() => {
      expect(screen.getAllByText(/^通知 n\d+$/)).toHaveLength(10);
    });

    // Load more #2 via sentinel: n3..n1 (3 items, < 5 → hasMore false)
    await act(async () => {
      intersectionCallback?.(
        /** @type {IntersectionObserverEntry[]} */ ([{ isIntersecting: true }]),
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText(/^通知 n\d+$/)).toHaveLength(13);
    });

    // Verify all 13 present, correct order (descending by createdAt)
    for (let i = 1; i <= 13; i++) {
      expect(screen.getByText(`通知 n${i}`)).toBeInTheDocument();
    }

    // No more load more
    expect(screen.queryByRole('button', { name: '查看先前通知' })).not.toBeInTheDocument();
  });

  it('should chain cursors correctly across multiple fetchMore calls', async () => {
    const all = Array.from({ length: 15 }, (_, i) => {
      const idx = 15 - i;
      return createNotification(`n${idx}`, idx);
    });

    const { fireAllListener, fireUnreadListener } = setupStatefulMocks(all);
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: '通知' }));

    act(() => {
      fireAllListener();
      fireUnreadListener([]);
    });

    // First load more
    await user.click(screen.getByRole('button', { name: '查看先前通知' }));
    await waitFor(() => {
      expect(screen.getByText('通知 n6')).toBeInTheDocument();
    });

    // Verify first fetchMore used listener cursor (n15..n11, lastDoc = n11 at index 4)
    expect(fetchMoreNotifications).toHaveBeenCalledTimes(1);
    const firstCall = /** @type {import('vitest').Mock} */ (fetchMoreNotifications).mock.calls[0];
    expect(firstCall[1]).toEqual({ _index: 4, id: 'n11' });

    // Second load more via sentinel — should use cursor from first fetchMore result (n6 at index 9)
    await act(async () => {
      intersectionCallback?.(
        /** @type {IntersectionObserverEntry[]} */ ([{ isIntersecting: true }]),
      );
    });

    await waitFor(() => {
      expect(fetchMoreNotifications).toHaveBeenCalledTimes(2);
    });
    const secondCall = /** @type {import('vitest').Mock} */ (fetchMoreNotifications).mock.calls[1];
    expect(secondCall[1]).toEqual({ _index: 9, id: 'n6' });
  });

  it('should merge correctly when listener fires new data after loadMore', async () => {
    const initial = Array.from({ length: 8 }, (_, i) => {
      const idx = 8 - i;
      return createNotification(`n${idx}`, idx);
    });

    const { fireAllListener, fireAllListenerWith, fireUnreadListener } =
      setupStatefulMocks(initial);
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: '通知' }));

    // Initial: n8..n4
    act(() => {
      fireAllListener();
      fireUnreadListener([]);
    });

    // loadMore: n3..n1
    await user.click(screen.getByRole('button', { name: '查看先前通知' }));
    await waitFor(() => {
      expect(screen.getByText('通知 n1')).toBeInTheDocument();
    });

    // New notification n9 arrives — listener shifts to n9..n5
    act(() => {
      fireAllListenerWith([
        createNotification('n9', 9),
        createNotification('n8', 8),
        createNotification('n7', 7),
        createNotification('n6', 6),
        createNotification('n5', 5),
      ]);
    });

    // All 9 unique notifications present: n9..n1
    await waitFor(() => {
      for (let i = 1; i <= 9; i++) {
        expect(screen.getByText(`通知 n${i}`)).toBeInTheDocument();
      }
    });

    expect(screen.getAllByText(/^通知 n\d+$/)).toHaveLength(9);
  });

  it('should paginate unread tab via client-side slice (Phase 1)', async () => {
    // 8 unread notifications — all within listener's 100 limit
    const unreadItems = Array.from({ length: 8 }, (_, i) => {
      const idx = 8 - i;
      return createNotification(`u${idx}`, idx);
    });
    const allItems = unreadItems.map((n) => ({ ...n, read: true }));

    const { fireAllListener, fireUnreadListener } = setupStatefulMocks(allItems);
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: '通知' }));

    act(() => {
      fireAllListener();
      fireUnreadListener(unreadItems);
    });

    // Switch to unread tab
    await user.click(screen.getByRole('tab', { name: '未讀' }));

    // Phase 1: initial 5 shown
    expect(screen.getAllByText(/^通知 u\d+$/)).toHaveLength(5);
    expect(screen.getByRole('button', { name: '查看先前通知' })).toBeInTheDocument();

    // Click loadMore — client-side expansion to 8
    await user.click(screen.getByRole('button', { name: '查看先前通知' }));
    await waitFor(() => {
      expect(screen.getAllByText(/^通知 u\d+$/)).toHaveLength(8);
    });

    // No more to load (listener has < 100)
    expect(screen.queryByRole('button', { name: '查看先前通知' })).not.toBeInTheDocument();

    // No server call — Phase 1 is purely client-side
    expect(fetchMoreUnreadNotifications).not.toHaveBeenCalled();
  });

  it(
    'should fallback to server fetch when listener at capacity (Phase 2)',
    { timeout: 15000 },
    async () => {
      // 100 unread in listener (at capacity) + 3 more on server
      const unreadItems = Array.from({ length: 100 }, (_, i) => {
        const idx = 100 - i;
        return createNotification(`u${idx}`, idx);
      });
      const serverExtra = Array.from({ length: 3 }, (_, i) => {
        const idx = 103 - i;
        return createNotification(`s${idx}`, idx);
      });

      const { fireAllListener, fireUnreadListener } = setupStatefulMocks([]);
      const user = userEvent.setup();

      // Mock server fetch for unread Phase 2
      /** @type {import('vitest').Mock} */ (fetchMoreUnreadNotifications).mockResolvedValueOnce({
        notifications: serverExtra,
        lastDoc: null,
      });

      renderPanel();
      await user.click(screen.getByRole('button', { name: '通知' }));

      act(() => {
        fireAllListener();
        fireUnreadListener(unreadItems);
      });

      // Switch to unread tab
      await user.click(screen.getByRole('tab', { name: '未讀' }));

      // Phase 1: expand client-side slice from 5 to 100 (19 x +5).
      await expandUnreadSliceToListenerCapacity();

      expect(screen.getAllByText(/^通知 u\d+$/)).toHaveLength(100);
      expect(fetchMoreUnreadNotifications).not.toHaveBeenCalled();

      // Phase 2: still hasMore (listener at capacity 100), next loadMore hits server
      expect(screen.getByRole('button', { name: '查看先前通知' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '查看先前通知' }));

      await waitFor(() => {
        expect(fetchMoreUnreadNotifications).toHaveBeenCalledTimes(1);
      });
      expect(fetchMoreUnreadNotifications).toHaveBeenCalledWith(
        'user1',
        { _index: 99, id: 'u1' },
        5,
      );

      // Server returned < 5, hasMore becomes false
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: '查看先前通知' })).not.toBeInTheDocument();
      });
    },
  );
});
