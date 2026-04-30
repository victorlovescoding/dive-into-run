import { vi, describe, it, expect, beforeEach } from 'vitest';
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
import NotificationProvider from '@/runtime/providers/NotificationProvider';
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
  const index = parseInt(id.replace('n', ''), 10);
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
 * 建立指定數量的通知陣列。
 * @param {number} count - 通知數量。
 * @param {number} [startIndex] - 起始索引，預設 1。
 * @returns {import('@/lib/notification-helpers').NotificationItem[]} 通知陣列。
 */
function createNotifications(count, startIndex = 1) {
  return Array.from({ length: count }, (_, i) => createNotification(`n${startIndex + i}`));
}

/** @type {((snapshot: { docs: QueryNotificationDoc[], docChanges: () => { type: string, doc: QueryNotificationDoc }[] }) => void) | undefined} */
let notificationsSnapshotCallback;
/** @type {((snapshot: { docs: QueryNotificationDoc[], docChanges: () => { type: string, doc: QueryNotificationDoc }[] }) => void) | undefined} */
let unreadSnapshotCallback;
const mockUnsubscribe = vi.fn();

/** @type {((entries: IntersectionObserverEntry[]) => void) | undefined} */
let intersectionCallback;

/**
 * @typedef {{ id: string, data: () => Omit<import('@/lib/notification-helpers').NotificationItem, 'id'> }} QueryNotificationDoc
 */

/**
 * 將 notification item 包成 Firestore QueryDocumentSnapshot 形狀。
 * @param {import('@/lib/notification-helpers').NotificationItem} notification - 通知資料。
 * @returns {QueryNotificationDoc} Firestore document snapshot 形狀。
 */
function createNotificationDoc(notification) {
  const { id, ...data } = notification;
  return { id, data: () => data };
}

/**
 * 建立 Firestore QuerySnapshot 形狀。
 * @param {QueryNotificationDoc[]} docs - snapshot docs。
 * @param {QueryNotificationDoc[]} [addedDocs] - docChanges added docs。
 * @returns {{ docs: QueryNotificationDoc[], docChanges: () => { type: string, doc: QueryNotificationDoc }[] }} QuerySnapshot 形狀。
 */
function createSnapshot(docs, addedDocs = []) {
  return {
    docs,
    docChanges: () => addedDocs.map((doc) => ({ type: 'added', doc })),
  };
}

/**
 * 找出 query constraints 中指定類型的 constraint。
 * @param {unknown} queryValue - Firestore query mock 回傳值。
 * @param {string} type - constraint type。
 * @returns {any} constraint。
 */
function getConstraint(queryValue, type) {
  return /** @type {{ constraints: any[] }} */ (queryValue).constraints.find((c) => c.type === type);
}

/**
 * 用指定 docs 設定 getDocs，依 startAfter cursor 回傳下一頁。
 * @param {QueryNotificationDoc[]} orderedDocs - 已依 createdAt desc 排序的所有 docs。
 * @returns {void}
 */
function mockPagedGetDocs(orderedDocs) {
  /** @type {import('vitest').Mock} */ (getDocs).mockImplementation((queryValue) => {
    const afterDoc = getConstraint(queryValue, 'startAfter')?.cursor;
    const limitCount = getConstraint(queryValue, 'limit')?.count ?? 5;
    const startIndex = afterDoc ? orderedDocs.indexOf(afterDoc) + 1 : 0;
    const page = orderedDocs.slice(startIndex, startIndex + limitCount);
    return Promise.resolve(createSnapshot(page));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  notificationsSnapshotCallback = undefined;
  unreadSnapshotCallback = undefined;
  intersectionCallback = undefined;

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
    return mockUnsubscribe;
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
 * 觸發 all notifications listener。
 * @param {QueryNotificationDoc[]} docs - listener docs。
 * @param {QueryNotificationDoc[]} [addedDocs] - 新增 docs。
 * @returns {void}
 */
function emitNotifications(docs, addedDocs = []) {
  notificationsSnapshotCallback?.(createSnapshot(docs, addedDocs));
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
      emitNotifications(createNotifications(5).map(createNotificationDoc));
      emitUnread([]);
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
      emitNotifications(createNotifications(3).map(createNotificationDoc));
      emitUnread([]);
    });

    // Assert
    expect(screen.queryByRole('button', { name: '查看先前通知' })).not.toBeInTheDocument();
  });

  it('should load more notifications when clicking "查看先前通知"', async () => {
    // Arrange
    const user = userEvent.setup();
    const docs = createNotifications(10).map(createNotificationDoc);
    const initialDocs = docs.slice(0, 5);
    mockPagedGetDocs(docs);

    renderPanel();
    await user.click(screen.getByRole('button', { name: '通知' }));

    act(() => {
      emitNotifications(initialDocs);
      emitUnread([]);
    });

    // Act — click load more button
    await user.click(screen.getByRole('button', { name: '查看先前通知' }));

    // Assert — production repo path builds a cursor query with listener lastDoc.
    expect(where).toHaveBeenCalledWith('recipientUid', '==', 'user1');
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(startAfter).toHaveBeenCalledWith(initialDocs[4]);
    expect(limit).toHaveBeenCalledWith(5);
    expect(getDocs).toHaveBeenCalledWith(
      expect.objectContaining({
        constraints: expect.arrayContaining([
          expect.objectContaining({ type: 'startAfter', cursor: initialDocs[4] }),
          expect.objectContaining({ type: 'limit', count: 5 }),
        ]),
      }),
    );

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
    const docs = createNotifications(10).map(createNotificationDoc);
    mockPagedGetDocs(docs);

    renderPanel();
    await user.click(screen.getByRole('button', { name: '通知' }));

    act(() => {
      emitNotifications(docs.slice(0, 5));
      emitUnread([]);
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
    const docs = createNotifications(12).map(createNotificationDoc);
    mockPagedGetDocs(docs);

    renderPanel();
    await user.click(screen.getByRole('button', { name: '通知' }));

    act(() => {
      emitNotifications(docs.slice(0, 5));
      emitUnread([]);
    });

    // First load more — returns 5, hasMore still true
    await user.click(screen.getByRole('button', { name: '查看先前通知' }));

    await waitFor(() => {
      expect(screen.getByText('通知 n10')).toBeInTheDocument();
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
    const callCountAfter = /** @type {import('vitest').Mock} */ (getDocs).mock.calls.length;
    expect(callCountAfter).toBe(2);
  });

  it('should not lose or duplicate notifications when listener fires after loadMore', async () => {
    // Regression test: listener 和 loadMore 的 race condition
    // 1. Listener: [n5,n4,n3,n2,n1]  2. loadMore: [n0]
    // 3. Listener fires again: [n6,n5,n4,n3,n2] (n1 掉出 top 5)
    // → n1 不該消失，n0 不該重複
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: '通知' }));

    // Step 1: Initial listener
    const initialDocs = createNotifications(5).map(createNotificationDoc);
    const olderDoc = createNotificationDoc(createNotification('n0'));
    mockPagedGetDocs([...initialDocs, olderDoc]);

    act(() => {
      emitNotifications(initialDocs);
      emitUnread([]);
    });

    // Step 2: loadMore fetches older notification
    await user.click(screen.getByRole('button', { name: '查看先前通知' }));
    await waitFor(() => {
      expect(screen.getByText('通知 n0')).toBeInTheDocument();
    });

    // Step 3: New notification n6 arrives — listener shifts window, n1 drops out
    act(() => {
      const shifted = [
        createNotification('n6'),
        createNotification('n5'),
        createNotification('n4'),
        createNotification('n3'),
        createNotification('n2'),
      ].map(createNotificationDoc);
      emitNotifications(shifted, [shifted[0]]);
    });

    // Step 4: All 7 unique notifications present — no gaps, no duplicates
    await waitFor(() => {
      for (const id of ['n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6']) {
        expect(screen.getByText(`通知 ${id}`)).toBeInTheDocument();
      }
    });

    const allItems = screen.getAllByText(/^通知 n\d+$/);
    expect(allItems).toHaveLength(7);
  });
});
