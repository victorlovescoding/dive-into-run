import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const firestoreMock = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn((...path) => ({ kind: 'collection', path })),
  doc: vi.fn((...path) => ({ kind: 'doc', path })),
  getDocs: vi.fn(),
  limit: vi.fn((count) => ({ type: 'limit', count })),
  onSnapshot: vi.fn(),
  orderBy: vi.fn((field, direction) => ({ type: 'orderBy', field, direction })),
  query: vi.fn((source, ...constraints) => ({ source, constraints })),
  serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
  startAfter: vi.fn((cursor) => ({ type: 'startAfter', cursor })),
  updateDoc: vi.fn(),
  where: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
  writeBatch: vi.fn(() => ({ commit: vi.fn(), set: vi.fn() })),
}));

const authMock = vi.hoisted(() => ({
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/firestore', () => firestoreMock);

vi.mock('firebase/auth', () => authMock);

vi.mock('@/config/client/firebase-client', () => ({
  auth: {},
  db: {},
  provider: {},
  storage: {},
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
import NotificationProvider, {
  useNotificationContext,
} from '@/runtime/providers/NotificationProvider';
import NotificationPanel from '@/components/Notifications/NotificationPanel';
import NotificationBell from '@/components/Notifications/NotificationBell';
import {
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  startAfter,
  where,
} from 'firebase/firestore';
import {
  createIndexedNotificationFixture,
  createNotificationDocSnapshot,
  createNotificationList,
} from '../../_helpers/notification-fixtures';

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
  return /** @type {import('@/lib/notification-helpers').NotificationItem} */ (
    createIndexedNotificationFixture(id, index, { read })
  );
}

/** @type {((entries: IntersectionObserverEntry[]) => void) | undefined} */
let intersectionCallback;
/** @type {import('@/runtime/providers/notification-context').NotificationContextValue | undefined} */
let latestNotificationContext;
/** @type {((snapshot: { docs: QueryNotificationDoc[], docChanges: () => { type: string, doc: QueryNotificationDoc }[] }) => void) | undefined} */
let notificationsSnapshotCallback;
/** @type {((snapshot: { docs: QueryNotificationDoc[], docChanges: () => { type: string, doc: QueryNotificationDoc }[] }) => void) | undefined} */
let unreadSnapshotCallback;

/**
 * @typedef {{ id: string, data: () => Omit<import('@/lib/notification-helpers').NotificationItem, 'id'> }} QueryNotificationDoc
 */

/**
 * 將 notification item 包成 Firestore QueryDocumentSnapshot 形狀。
 * @param {import('@/lib/notification-helpers').NotificationItem} notification - 通知資料。
 * @returns {QueryNotificationDoc} Firestore document snapshot 形狀。
 */
function createNotificationDoc(notification) {
  return /** @type {QueryNotificationDoc} */ (createNotificationDocSnapshot(notification));
}

/**
 * 建立 Firestore QuerySnapshot 形狀。
 * @param {QueryNotificationDoc[]} docs - snapshot docs。
 * @returns {{ docs: QueryNotificationDoc[], docChanges: () => { type: string, doc: QueryNotificationDoc }[] }} QuerySnapshot 形狀。
 */
function createSnapshot(docs) {
  return { docs, docChanges: () => [] };
}

/**
 * 觸發 all notifications listener。
 * @param {QueryNotificationDoc[]} docs - listener docs。
 * @returns {void}
 */
function emitNotifications(docs) {
  notificationsSnapshotCallback?.(createSnapshot(docs));
}

/**
 * 觸發 unread notifications listener。
 * @param {QueryNotificationDoc[]} docs - listener docs。
 * @returns {void}
 */
function emitUnread(docs) {
  unreadSnapshotCallback?.(createSnapshot(docs));
}

/**
 * 建立 stateful pagination mock，模擬 Firestore cursor 行為。
 * @param {import('@/lib/notification-helpers').NotificationItem[]} allNotifications - 完整 dataset，已依 createdAt desc 排序。
 * @param {number} listenerLimit - listener 回傳筆數。
 * @returns {{ allDocs: QueryNotificationDoc[], fireAllListener: () => void, fireUnreadListener: (items: import('@/lib/notification-helpers').NotificationItem[]) => void, fireAllListenerWith: (items: import('@/lib/notification-helpers').NotificationItem[]) => void, setUnreadServerDocs: (items: import('@/lib/notification-helpers').NotificationItem[]) => QueryNotificationDoc[] }} mock 控制器。
 */
function setupStatefulFirestore(allNotifications, listenerLimit = 5) {
  const allDocs = allNotifications.map(createNotificationDoc);
  /** @type {QueryNotificationDoc[]} */
  let unreadServerDocs = allDocs.filter((doc) => !doc.data().read);
  /** @type {QueryNotificationDoc[]} */
  let unreadListenerDocs = unreadServerDocs;

  /** @type {import('vitest').Mock} */ (getDocs).mockImplementation((queryValue) => {
    const { constraints } = /** @type {{ constraints: any[] }} */ (queryValue);
    const isUnreadQuery = constraints.some(
      (constraint) =>
        constraint.type === 'where' && constraint.field === 'read' && constraint.value === false,
    );
    const afterDoc = constraints.find((constraint) => constraint.type === 'startAfter')?.cursor;
    const limitCount = constraints.find((constraint) => constraint.type === 'limit')?.count ?? 5;
    const docs = isUnreadQuery ? unreadServerDocs : allDocs;
    const startIdx = afterDoc ? docs.indexOf(afterDoc) + 1 : 0;
    return Promise.resolve(createSnapshot(docs.slice(startIdx, startIdx + limitCount)));
  });

  return {
    allDocs,
    /** 觸發 listener 回傳前 listenerLimit 筆資料。 */
    fireAllListener: () => {
      emitNotifications(allDocs.slice(0, listenerLimit));
    },
    /**
     * 觸發 unread listener 回傳指定筆數。
     * @param {import('@/lib/notification-helpers').NotificationItem[]} items - 未讀通知。
     */
    fireUnreadListener: (items) => {
      const docs = items.map(createNotificationDoc);
      unreadListenerDocs = docs;
      unreadServerDocs = docs;
      emitUnread(docs);
    },
    /**
     * 用自訂資料觸發 all listener（模擬新通知到達）。
     * @param {import('@/lib/notification-helpers').NotificationItem[]} items - 新資料。
     */
    fireAllListenerWith: (items) => {
      emitNotifications(items.map(createNotificationDoc));
    },
    /**
     * 設定 unread server 分頁資料。
     * @param {import('@/lib/notification-helpers').NotificationItem[]} items - server 分頁完整資料。
     * @returns {QueryNotificationDoc[]} docs。
     */
    setUnreadServerDocs: (items) => {
      const listenerDocsById = new Map(unreadListenerDocs.map((doc) => [doc.id, doc]));
      unreadServerDocs = items.map(
        (item) => listenerDocsById.get(item.id) ?? createNotificationDoc(item),
      );
      return unreadServerDocs;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  intersectionCallback = undefined;
  latestNotificationContext = undefined;
  notificationsSnapshotCallback = undefined;
  unreadSnapshotCallback = undefined;

  /** @type {import('vitest').Mock} */ (onSnapshot).mockImplementation((queryValue, onNext) => {
    const hasUnreadConstraint = /** @type {{ constraints: any[] }} */ (queryValue).constraints.some(
      (constraint) =>
        constraint.type === 'where' && constraint.field === 'read' && constraint.value === false,
    );
    if (hasUnreadConstraint) {
      unreadSnapshotCallback = onNext;
    } else {
      notificationsSnapshotCallback = onNext;
    }
    return vi.fn();
  });

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
    const all = createNotificationList(13, { descending: true });

    const { fireAllListener, fireUnreadListener } = setupStatefulFirestore(all);
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
    const all = createNotificationList(15, { descending: true });

    const { allDocs, fireAllListener, fireUnreadListener } = setupStatefulFirestore(all);
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
    expect(startAfter).toHaveBeenCalledWith(allDocs[4]);

    // Second load more via sentinel — should use cursor from first fetchMore result (n6 at index 9)
    await act(async () => {
      intersectionCallback?.(
        /** @type {IntersectionObserverEntry[]} */ ([{ isIntersecting: true }]),
      );
    });

    await waitFor(() => {
      expect(startAfter).toHaveBeenCalledWith(allDocs[9]);
    });
    expect(startAfter).toHaveBeenCalledWith(allDocs[4]);
    expect(startAfter).toHaveBeenCalledWith(allDocs[9]);
    expect(where).toHaveBeenCalledWith('recipientUid', '==', 'user1');
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(limit).toHaveBeenCalledWith(5);
  });

  it('should merge correctly when listener fires new data after loadMore', async () => {
    const initial = createNotificationList(8, { descending: true });

    const { fireAllListener, fireAllListenerWith, fireUnreadListener } =
      setupStatefulFirestore(initial);
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
    const unreadItems = createNotificationList(8, { prefix: 'u', descending: true });
    const allItems = unreadItems.map((n) => ({ ...n, read: true }));

    const { fireAllListener, fireUnreadListener } = setupStatefulFirestore(allItems);
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

    // No server query — Phase 1 is purely client-side.
    expect(startAfter).not.toHaveBeenCalled();
    expect(getDocs).not.toHaveBeenCalled();
  });

  it(
    'should fallback to server fetch when listener at capacity (Phase 2)',
    { timeout: 15000 },
    async () => {
      // 100 unread in listener (at capacity) + 3 more on server
      const unreadItems = createNotificationList(100, { prefix: 'u', descending: true });
      const serverExtra = createNotificationList(3, {
        startIndex: 101,
        prefix: 's',
        descending: true,
      });

      const { fireAllListener, fireUnreadListener, setUnreadServerDocs } =
        setupStatefulFirestore([]);
      const user = userEvent.setup();

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
      expect(startAfter).not.toHaveBeenCalled();

      const unreadServerDocs = setUnreadServerDocs([...unreadItems, ...serverExtra]);

      // Phase 2: still hasMore (listener at capacity 100), next loadMore hits server
      expect(screen.getByRole('button', { name: '查看先前通知' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '查看先前通知' }));

      await waitFor(() => {
        expect(startAfter).toHaveBeenCalledWith(unreadServerDocs[99]);
      });
      expect(where).toHaveBeenCalledWith('recipientUid', '==', 'user1');
      expect(where).toHaveBeenCalledWith('read', '==', false);
      expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(limit).toHaveBeenCalledWith(5);

      // Server returned < 5, hasMore becomes false
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: '查看先前通知' })).not.toBeInTheDocument();
      });
    },
  );
});
