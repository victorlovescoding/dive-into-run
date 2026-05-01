import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
  updateDoc: vi.fn(),
  where: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
  writeBatch: vi.fn(() => ({ set: vi.fn(), commit: vi.fn() })),
}));

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

import { AuthContext } from '@/runtime/providers/AuthProvider';
import NotificationProvider from '@/runtime/providers/NotificationProvider';
import NotificationToast from '@/components/Notifications/NotificationToast';
import NotificationBell from '@/components/Notifications/NotificationBell';
import { onSnapshot } from 'firebase/firestore';
import { createFirestoreQuerySnapshot } from '../../_helpers/factories';

const mockedOnSnapshot = /** @type {import('vitest').Mock} */ (onSnapshot);

/** @type {((snapshot: ReturnType<typeof createFirestoreQuerySnapshot>) => void) | undefined} */
let allSnapshotCallback;
/** @type {((snapshot: ReturnType<typeof createFirestoreQuerySnapshot>) => void) | undefined} */
let unreadSnapshotCallback;
/** @type {((error: Error) => void) | undefined} */
let allErrorCallback;
/** @type {((error: Error) => void) | undefined} */
let unreadErrorCallback;

/**
 * 建立測試通知資料。
 * @param {string} id - 通知 ID。
 * @param {string} message - 通知訊息。
 * @param {boolean} [read] - 是否已讀。
 * @returns {object} Firestore document data。
 */
function createNotificationData(id, message, read = false) {
  return {
    recipientUid: 'user1',
    type: 'event_modified',
    actorUid: 'actor1',
    actorName: 'Actor',
    actorPhotoURL: '',
    entityType: 'event',
    entityId: 'evt1',
    entityTitle: '跑步',
    commentId: null,
    message,
    read,
    createdAt: {
      toDate: () => new Date(Date.now() - 5 * 60 * 1000),
      toMillis: () => Date.now() - 5 * 60 * 1000,
    },
  };
}

/**
 * 建立 Firestore query snapshot mock。
 * @param {Array<{ id: string, data: object }>} docs - 文件資料。
 * @param {Array<{ type: string, id: string, data: object }>} [changes] - docChanges 資料。
 * @returns {ReturnType<typeof createFirestoreQuerySnapshot>} snapshot mock。
 */
function createSnapshot(docs, changes = []) {
  return createFirestoreQuerySnapshot(docs, {
    changes: changes.map((change) => ({
      type: change.type,
      doc: { id: change.id, data: change.data },
    })),
  });
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
 * @param {Array<{ id: string, data: object }>} docs - 文件資料。
 * @param {Array<{ type: string, id: string, data: object }>} [changes] - docChanges 資料。
 * @returns {void}
 */
function emitAllSnapshot(docs, changes = []) {
  act(() => {
    allSnapshotCallback?.(createSnapshot(docs, changes));
  });
}

/**
 * 推送 unread listener snapshot。
 * @param {Array<{ id: string, data: object }>} docs - 文件資料。
 * @returns {void}
 */
function emitUnreadSnapshot(docs) {
  act(() => {
    unreadSnapshotCallback?.(createSnapshot(docs));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
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

afterEach(() => {
  vi.useRealTimers();
});

const mockUser = {
  uid: 'user1',
  name: 'Test',
  email: null,
  photoURL: null,
  bio: null,
  getIdToken: async () => '',
};

/**
 * 渲染含 Provider 的 Toast + Bell 元件。
 * @returns {import('@testing-library/react').RenderResult} render 結果。
 */
function renderWithProviders() {
  return render(
    <AuthContext.Provider value={{ user: mockUser, setUser: () => {}, loading: false }}>
      <NotificationProvider>
        <NotificationBell />
        <NotificationToast />
      </NotificationProvider>
    </AuthContext.Provider>,
  );
}

describe('NotificationToast', () => {
  it('wires Firestore listeners with unsubscribe and error callbacks', () => {
    // Arrange & Act
    const { unmount } = renderWithProviders();

    // Assert
    expect(allSnapshotCallback).toEqual(expect.any(Function));
    expect(unreadSnapshotCallback).toEqual(expect.any(Function));
    expect(allErrorCallback).toEqual(expect.any(Function));
    expect(unreadErrorCallback).toEqual(expect.any(Function));

    unmount();
    expect(mockUnsubscribeAll.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(mockUnsubscribeUnread.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('新通知到來時顯示 toast', async () => {
    // Arrange
    renderWithProviders();
    emitAllSnapshot([]);
    emitUnreadSnapshot([]);

    // Act
    emitAllSnapshot(
      [{ id: 'n1', data: createNotificationData('n1', '新通知訊息') }],
      [{ type: 'added', id: 'n1', data: createNotificationData('n1', '新通知訊息') }],
    );

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('新通知訊息');
  });

  it('toast 約 5 秒後自動消失', async () => {
    // Arrange
    renderWithProviders();
    emitAllSnapshot([]);
    emitUnreadSnapshot([]);

    // Act
    emitAllSnapshot(
      [{ id: 'n1', data: createNotificationData('n1', '即將消失') }],
      [{ type: 'added', id: 'n1', data: createNotificationData('n1', '即將消失') }],
    );
    expect(screen.getByRole('status')).toHaveTextContent('即將消失');

    // Assert
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('面板開啟時不顯示 toast', async () => {
    // Arrange
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    renderWithProviders();
    emitAllSnapshot([]);
    emitUnreadSnapshot([]);

    // Act — 點擊鈴鐺開啟面板
    const clickPromise = user.click(screen.getByRole('button', { name: /通知/ }));
    await vi.advanceTimersByTimeAsync(0);
    await clickPromise;

    emitAllSnapshot(
      [{ id: 'n1', data: createNotificationData('n1', '不應顯示') }],
      [{ type: 'added', id: 'n1', data: createNotificationData('n1', '不應顯示') }],
    );

    // Assert
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('初始載入不觸發 toast', () => {
    // Arrange & Act
    renderWithProviders();
    emitAllSnapshot([{ id: 'n1', data: createNotificationData('n1', '初始通知') }]);
    emitUnreadSnapshot([{ id: 'n1', data: createNotificationData('n1', '初始通知') }]);

    // Assert — onNew 不會在初始載入時被呼叫，所以沒有 toast
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('多則通知依序顯示（一次一則）', () => {
    // Arrange
    renderWithProviders();
    emitAllSnapshot([]);
    emitUnreadSnapshot([]);

    // Act — 同時送兩則通知
    emitAllSnapshot(
      [
        { id: 'n1', data: createNotificationData('n1', '第一則') },
        { id: 'n2', data: createNotificationData('n2', '第二則') },
      ],
      [
        { type: 'added', id: 'n1', data: createNotificationData('n1', '第一則') },
        { type: 'added', id: 'n2', data: createNotificationData('n2', '第二則') },
      ],
    );

    // Assert — 只顯示第一則
    expect(screen.getByRole('status')).toHaveTextContent('第一則');
    expect(screen.queryByText('第二則')).not.toBeInTheDocument();

    // Act — 5 秒後第一則消失，第二則出現
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole('status')).toHaveTextContent('第二則');

    // Act — 再 5 秒後第二則也消失
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
