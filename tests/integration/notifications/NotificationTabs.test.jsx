import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUnsubscribeAll = vi.fn();
const mockUnsubscribeUnread = vi.fn();

vi.mock('@/config/client/firebase-client', () => ({
  auth: { app: 'test-auth-app' },
  db: { app: 'test-firestore-app' },
  provider: {},
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => vi.fn()),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db, path) => ({ db, path })),
  doc: vi.fn((db, ...segments) => ({ db, path: segments.join('/') })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn((count) => ({ type: 'limit', count })),
  onSnapshot: vi.fn(),
  orderBy: vi.fn((field, direction) => ({ type: 'orderBy', field, direction })),
  query: vi.fn((source, ...constraints) => ({ source, constraints })),
  serverTimestamp: vi.fn(() => new Date()),
  setDoc: vi.fn(),
  startAfter: vi.fn((docRef) => ({ type: 'startAfter', docRef })),
  updateDoc: vi.fn(() => Promise.resolve()),
  where: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
  writeBatch: vi.fn(() => ({ set: vi.fn(), commit: vi.fn() })),
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
import { onSnapshot } from 'firebase/firestore';

const mockedOnSnapshot = /** @type {import('vitest').Mock} */ (onSnapshot);

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
    createdAt: {
      toDate: () => new Date(Date.now() - 5 * 60 * 1000),
      toMillis: () => Date.now() - 5 * 60 * 1000,
    },
  });
}

/** @type {((snapshot: ReturnType<typeof createSnapshot>) => void) | undefined} */
let allSnapshotCallback;
/** @type {((snapshot: ReturnType<typeof createSnapshot>) => void) | undefined} */
let unreadSnapshotCallback;
/** @type {((error: Error) => void) | undefined} */
let allErrorCallback;
/** @type {((error: Error) => void) | undefined} */
let unreadErrorCallback;

/**
 * 建立 Firestore 文件 snapshot mock。
 * @param {string} id - 文件 ID。
 * @param {object} data - 文件資料。
 * @returns {{ id: string, data: () => object }} 文件 snapshot。
 */
function createDocSnapshot(id, data) {
  return { id, data: () => data };
}

/**
 * 建立 Firestore query snapshot mock。
 * @param {Array<{ id: string, data: object }>} docs - 文件資料。
 * @param {Array<{ type: string, id: string, data: object }>} [changes] - docChanges 資料。
 * @returns {{ docs: Array<{ id: string, data: () => object }>, docChanges: () => Array<{ type: string, doc: { id: string, data: () => object } }> }} snapshot mock。
 */
function createSnapshot(docs, changes = []) {
  return {
    docs: docs.map((doc) => createDocSnapshot(doc.id, doc.data)),
    docChanges: () =>
      changes.map((change) => ({
        type: change.type,
        doc: createDocSnapshot(change.id, change.data),
      })),
  };
}

/**
 * 判斷 query 是否為未讀通知 listener。
 * @param {{ constraints?: Array<{ field?: string, value?: unknown }> }} queryRef - query mock。
 * @returns {boolean} 是否含 read=false 條件。
 */
function isUnreadNotificationsQuery(queryRef) {
  return Boolean(
    queryRef.constraints?.some(
      (constraint) => constraint.field === 'read' && constraint.value === false,
    ),
  );
}

/**
 * 推送 all listener snapshot。
 * @param {import('@/lib/notification-helpers').NotificationItem[]} notifications - 通知資料。
 * @param {Array<{ type: string, id: string, data: object }>} [changes] - docChanges 資料。
 * @returns {void}
 */
function emitAllSnapshot(notifications, changes = []) {
  act(() => {
    allSnapshotCallback?.(
      createSnapshot(
        notifications.map((notification) => ({ id: notification.id, data: notification })),
        changes,
      ),
    );
  });
}

/**
 * 推送 unread listener snapshot。
 * @param {import('@/lib/notification-helpers').NotificationItem[]} notifications - 通知資料。
 * @returns {void}
 */
function emitUnreadSnapshot(notifications) {
  act(() => {
    unreadSnapshotCallback?.(
      createSnapshot(
        notifications.map((notification) => ({ id: notification.id, data: notification })),
      ),
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  allSnapshotCallback = undefined;
  unreadSnapshotCallback = undefined;
  allErrorCallback = undefined;
  unreadErrorCallback = undefined;

  mockedOnSnapshot.mockImplementation((queryRef, onNext, onError) => {
    if (isUnreadNotificationsQuery(queryRef)) {
      unreadSnapshotCallback = onNext;
      unreadErrorCallback = onError;
      return mockUnsubscribeUnread;
    }

    allSnapshotCallback = onNext;
    allErrorCallback = onError;
    return mockUnsubscribeAll;
  });
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
// NotificationTabs
// ===========================================================================

describe('NotificationTabs', () => {
  it('should wire Firestore listeners with unsubscribe and error callbacks', async () => {
    // Arrange
    const user = userEvent.setup();
    const { unmount } = renderPanel();

    // Act
    await user.click(screen.getByRole('button', { name: '通知' }));

    // Assert
    expect(allSnapshotCallback).toEqual(expect.any(Function));
    expect(unreadSnapshotCallback).toEqual(expect.any(Function));
    expect(allErrorCallback).toEqual(expect.any(Function));
    expect(unreadErrorCallback).toEqual(expect.any(Function));

    unmount();
    expect(mockUnsubscribeAll.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(mockUnsubscribeUnread.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('should have「全部」tab selected by default', async () => {
    // Arrange
    const user = userEvent.setup();
    renderPanel();

    // Act — open panel
    await user.click(screen.getByRole('button', { name: '通知' }));

    // 送入通知資料
    emitAllSnapshot([createNotification('n1')]);
    emitUnreadSnapshot([createNotification('n1')]);

    // Assert
    const allTab = screen.getByRole('tab', { name: '全部' });
    expect(allTab).toHaveAttribute('aria-selected', 'true');

    const unreadTab = screen.getByRole('tab', { name: '未讀' });
    expect(unreadTab).toHaveAttribute('aria-selected', 'false');
  });

  it('should show only unread notifications when clicking「未讀」tab', async () => {
    // Arrange
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: '通知' }));

    // 送入混合已讀/未讀通知
    emitAllSnapshot([
      createNotification('n1', false),
      createNotification('n2', true),
      createNotification('n3', false),
    ]);
    emitUnreadSnapshot([createNotification('n1', false), createNotification('n3', false)]);

    // Act — click「未讀」tab
    await user.click(screen.getByRole('tab', { name: '未讀' }));

    // Assert — only unread items shown
    expect(screen.getByText('通知 n1')).toBeInTheDocument();
    expect(screen.getByText('通知 n3')).toBeInTheDocument();
    expect(screen.queryByText('通知 n2')).not.toBeInTheDocument();
  });

  it('should show「沒有未讀通知」when switching to「未讀」with no unread', async () => {
    // Arrange
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: '通知' }));

    // 所有通知都已讀
    emitAllSnapshot([createNotification('n1', true), createNotification('n2', true)]);
    emitUnreadSnapshot([]);

    // Act
    await user.click(screen.getByRole('tab', { name: '未讀' }));

    // Assert
    expect(screen.getByText('沒有未讀通知')).toBeInTheDocument();
  });

  it('should remove notification from「未讀」view after marking as read', async () => {
    // Arrange
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: '通知' }));

    emitAllSnapshot([createNotification('n1', false), createNotification('n2', false)]);
    emitUnreadSnapshot([createNotification('n1', false), createNotification('n2', false)]);

    // 切到未讀 tab
    await user.click(screen.getByRole('tab', { name: '未讀' }));

    // Act — 點擊第一則通知（觸發 markAsRead → optimistic update）
    const unreadPanel = screen.getByRole('tabpanel', { name: '未讀' });
    await user.click(within(unreadPanel).getByRole('button', { name: /通知 n1/ }));

    // Assert — n1 應從列表消失（optimistic update 把它從 unreadNotifications 移除）
    expect(screen.queryByText('通知 n1')).not.toBeInTheDocument();
  });

  it('should have correct a11y structure for tabs', async () => {
    // Arrange
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: '通知' }));

    emitAllSnapshot([]);
    emitUnreadSnapshot([]);

    // Assert — tablist container
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();

    // Assert — two tab buttons
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);

    // Assert — aria-selected
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');

    // Act — switch tab
    await user.click(tabs[1]);

    // Assert — selection switches
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
  });
});
