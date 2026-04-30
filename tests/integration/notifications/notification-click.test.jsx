import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  getFirestore: vi.fn(),
  limit: vi.fn((value) => ({ type: 'limit', value })),
  onSnapshot: vi.fn(),
  orderBy: vi.fn((field, direction) => ({ type: 'orderBy', field, direction })),
  query: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
  setDoc: vi.fn(),
  startAfter: vi.fn((value) => ({ type: 'startAfter', value })),
  updateDoc: vi.fn(),
  where: vi.fn((field, operator, value) => ({ type: 'where', field, operator, value })),
}));

const authMocks = vi.hoisted(() => ({
  connectAuthEmulator: vi.fn(),
  getAuth: vi.fn(),
  GoogleAuthProvider: vi.fn(() => ({ setCustomParameters: vi.fn() })),
  onAuthStateChanged: vi.fn(() => vi.fn()),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/config/client/firebase-client', () => ({
  db: {},
  auth: {},
  provider: {},
}));

vi.mock('firebase/firestore', () => ({
  ...firestoreMocks,
}));

vi.mock('firebase/auth', () => ({
  ...authMocks,
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
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
  doc,
  onSnapshot,
  query,
  updateDoc,
} from 'firebase/firestore';
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

/**
 * @typedef {{ docs: Array<{ id: string, data: () => import('@/lib/notification-helpers').NotificationItem }>, docChanges: () => Array<{ type: string, doc: { id: string, data: () => import('@/lib/notification-helpers').NotificationItem } }> }} NotificationQuerySnapshot
 */

/** @type {((snapshot: NotificationQuerySnapshot) => void) | undefined} */
let allSnapshotNext;
/** @type {((error: Error) => void) | undefined} */
let allSnapshotError;
/** @type {((snapshot: NotificationQuerySnapshot) => void) | undefined} */
let unreadSnapshotNext;
/** @type {((error: Error) => void) | undefined} */
let unreadSnapshotError;
const unsubscribeCallbacks = /** @type {import('vitest').Mock[]} */ ([]);

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
 * 建立 Firestore document snapshot mock。
 * @param {import('@/lib/notification-helpers').NotificationItem} notification - 通知資料。
 * @returns {{ id: string, data: () => import('@/lib/notification-helpers').NotificationItem }} snapshot。
 */
function createNotificationSnapshot(notification) {
  return {
    id: notification.id,
    data: () => notification,
  };
}

/**
 * 建立 Firestore query snapshot mock。
 * @param {import('@/lib/notification-helpers').NotificationItem[]} notifications - 通知列表。
 * @param {{ type: string, doc: { id: string, data: () => import('@/lib/notification-helpers').NotificationItem } }[]} [changes] - docChanges。
 * @returns {NotificationQuerySnapshot} query snapshot。
 */
function createQuerySnapshot(notifications, changes = []) {
  return {
    docs: notifications.map(createNotificationSnapshot),
    docChanges: () => changes,
  };
}

/**
 * 模擬 all notifications 第二次 snapshot，可帶 added docChanges。
 * @param {import('@/lib/notification-helpers').NotificationItem[]} notifications - 通知列表。
 */
function emitAllNotifications(notifications) {
  const addedChanges = notifications.map((notification) => ({
    type: 'added',
    doc: createNotificationSnapshot(notification),
  }));
  allSnapshotNext?.(createQuerySnapshot(notifications, addedChanges));
}

/**
 * 模擬 unread notifications snapshot。
 * @param {import('@/lib/notification-helpers').NotificationItem[]} notifications - 通知列表。
 */
function emitUnreadNotifications(notifications) {
  unreadSnapshotNext?.(createQuerySnapshot(notifications));
}

beforeEach(() => {
  vi.clearAllMocks();
  allSnapshotNext = undefined;
  allSnapshotError = undefined;
  unreadSnapshotNext = undefined;
  unreadSnapshotError = undefined;
  unsubscribeCallbacks.length = 0;

  const mockedDoc = /** @type {import('vitest').Mock} */ (doc);
  const mockedOnSnapshot = /** @type {import('vitest').Mock} */ (onSnapshot);
  const mockedQuery = /** @type {import('vitest').Mock} */ (query);

  firestoreMocks.collection.mockImplementation((_db, ...segments) => ({
    path: segments.join('/'),
  }));
  mockedDoc.mockImplementation((_db, ...segments) => ({
    id: segments[segments.length - 1],
    path: segments.join('/'),
  }));
  mockedQuery.mockImplementation((base, ...constraints) => ({ base, constraints }));
  mockedOnSnapshot.mockImplementation((target, onNext, onError) => {
    const unsubscribe = vi.fn();
    unsubscribeCallbacks.push(unsubscribe);

    const isUnreadListener = target.constraints?.some(
      (constraint) =>
        constraint.type === 'where' &&
        constraint.field === 'read' &&
        constraint.operator === '==' &&
        constraint.value === false,
    );

    if (isUnreadListener) {
      unreadSnapshotNext = onNext;
      unreadSnapshotError = onError;
    } else {
      allSnapshotNext = onNext;
      allSnapshotError = onError;
    }

    onNext(createQuerySnapshot([]));
    return unsubscribe;
  });
});

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
    expect(allSnapshotError).toEqual(expect.any(Function));
    expect(unreadSnapshotError).toEqual(expect.any(Function));
    expect(unsubscribeCallbacks).toHaveLength(2);

    const notification = createMockNotification({
      id: 'n-evt',
      type: 'event_modified',
      entityId: 'evt1',
    });

    // Open panel
    await user.click(screen.getByRole('button', { name: /通知/ }));

    // Push notifications into context
    act(() => {
      emitAllNotifications([notification]);
      emitUnreadNotifications([notification]);
    });

    // Act — click the notification item
    await user.click(screen.getByRole('button', { name: /週末跑步/ }));

    // Assert
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'notifications/n-evt' }),
      { read: true },
    );
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
      emitAllNotifications([notification]);
      emitUnreadNotifications([notification]);
    });

    // Act
    await user.click(screen.getByRole('button', { name: /新的留言/ }));

    // Assert
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'notifications/n-post' }),
      { read: true },
    );
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
      emitAllNotifications(notifications);
      emitUnreadNotifications(notifications);
    });

    // Badge should show 3
    expect(screen.getByText('3')).toBeInTheDocument();

    // Open panel + click first notification
    await user.click(screen.getByRole('button', { name: /通知/ }));
    await user.click(screen.getByRole('button', { name: /通知一/ }));

    // Simulate unreadCallback update (as if Firestore responded)
    act(() => {
      emitUnreadNotifications(notifications.slice(1));
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
      emitAllNotifications([notification]);
      emitUnreadNotifications([notification]);
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
