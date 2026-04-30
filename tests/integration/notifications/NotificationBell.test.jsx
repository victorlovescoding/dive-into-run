import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useContext, useEffect } from 'react';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// jsdom 缺少 matchMedia，Navbar 的 useMobileDrawer 需要它
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
import {
  NotificationContext,
  default as NotificationProvider,
} from '@/runtime/providers/NotificationProvider';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';
import NotificationBell from '@/components/Notifications/NotificationBell';
import Navbar from '@/components/Navbar/Navbar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUser = {
  uid: 'u1',
  name: 'Test',
  email: 't@t.com',
  photoURL: null,
  bio: null,
  getIdToken: vi.fn(),
};

/**
 * @typedef {{ id: string, data: () => Omit<import('@/lib/notification-helpers').NotificationItem, 'id'> }} QueryNotificationDoc
 */

/** @type {((snapshot: { docs: QueryNotificationDoc[], docChanges: () => { type: string, doc: QueryNotificationDoc }[] }) => void) | undefined} */
let unreadSnapshotCallback;

/**
 * 將 notification item 包成 Firestore QueryDocumentSnapshot 形狀。
 * @param {import('@/lib/notification-helpers').NotificationItem} notification - 通知資料。
 * @returns {QueryNotificationDoc} Firestore document snapshot 形狀。
 */
function createNotificationDoc(notification) {
  const { id, ...data } = notification;
  return {
    id,
    data: () => data,
  };
}

/**
 * 產生假通知清單。
 * @param {number} count - 通知數量。
 * @param {boolean} [read] - 是否已讀，預設 false。
 * @returns {QueryNotificationDoc[]} 假通知文件陣列。
 */
function fakeNotifications(count, read = false) {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    recipientUid: 'u1',
    type: /** @type {const} */ ('event_modified'),
    actorUid: 'a1',
    actorName: 'Actor',
    actorPhotoURL: '',
    entityType: /** @type {const} */ ('event'),
    entityId: 'e1',
    entityTitle: 'Test Event',
    commentId: null,
    message: 'test',
    read,
    createdAt: /** @type {any} */ (new Date()),
  })).map(createNotificationDoc);
}

/**
 * 建立 Firestore QuerySnapshot 形狀。
 * @param {QueryNotificationDoc[]} docs - snapshot docs。
 * @returns {{ docs: QueryNotificationDoc[], docChanges: () => { type: string, doc: QueryNotificationDoc }[] }} QuerySnapshot 形狀。
 */
function createSnapshot(docs) {
  return {
    docs,
    docChanges: () => [],
  };
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
 * 判斷 query 是否為 unread notifications listener。
 * @param {unknown} queryValue - Firestore query mock 回傳值。
 * @returns {boolean} 是否包含 read=false constraint。
 */
function isUnreadQuery(queryValue) {
  return /** @type {{ constraints: any[] }} */ (queryValue).constraints.some(
    (constraint) =>
      constraint.type === 'where' && constraint.field === 'read' && constraint.value === false,
  );
}

/**
 * 用 providers 包裹元件渲染。
 * @param {import('react').ReactElement} ui - 要渲染的元件。
 * @param {{ user?: object | null }} [options] - 選項。
 * @returns {import('@testing-library/react').RenderResult} render 結果。
 */
function renderWithProviders(ui, { user = null } = {}) {
  return render(
    <AuthContext.Provider value={{ user, setUser: () => {}, loading: false }}>
      <NotificationProvider>{ui}</NotificationProvider>
    </AuthContext.Provider>,
  );
}

// ---------------------------------------------------------------------------
// Mock callback captures
// ---------------------------------------------------------------------------

const mockUnsubscribeUnread = vi.fn();
const mockUnsubscribeAll = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  unreadSnapshotCallback = undefined;

  /** @type {import('vitest').Mock} */ (onSnapshot).mockImplementation((queryValue, onNext) => {
    if (isUnreadQuery(queryValue)) {
      unreadSnapshotCallback = onNext;
      return mockUnsubscribeUnread;
    }
    return mockUnsubscribeAll;
  });
});

// ===========================================================================
// NotificationContext
// ===========================================================================

describe('NotificationContext', () => {
  it('should setup listeners on login', () => {
    renderWithProviders(<div />, { user: mockUser });

    expect(where).toHaveBeenCalledWith('recipientUid', '==', 'u1');
    expect(where).toHaveBeenCalledWith('read', '==', false);
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(query).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ field: 'recipientUid', op: '==', value: 'u1' }),
      expect.objectContaining({ field: 'createdAt', type: 'orderBy' }),
      expect.objectContaining({ count: 5, type: 'limit' }),
    );
    expect(query).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ field: 'recipientUid', op: '==', value: 'u1' }),
      expect.objectContaining({ field: 'read', op: '==', value: false }),
      expect.objectContaining({ field: 'createdAt', type: 'orderBy' }),
      expect.objectContaining({ count: 100, type: 'limit' }),
    );
  });

  it('should cleanup listeners on logout', () => {
    const { rerender } = render(
      <AuthContext.Provider value={{ user: mockUser, setUser: () => {}, loading: false }}>
        <NotificationProvider>
          <div />
        </NotificationProvider>
      </AuthContext.Provider>,
    );

    expect(onSnapshot).toHaveBeenCalled();

    // Simulate logout
    rerender(
      <AuthContext.Provider value={{ user: null, setUser: () => {}, loading: false }}>
        <NotificationProvider>
          <div />
        </NotificationProvider>
      </AuthContext.Provider>,
    );

    expect(mockUnsubscribeUnread).toHaveBeenCalled();
    expect(mockUnsubscribeAll).toHaveBeenCalled();
  });

  it('should expose unreadCount from unread listener', () => {
    /** @type {number | undefined} */
    let capturedCount;

    /**
     * 讀取 NotificationContext 中 unreadCount 的測試元件。
     * @returns {null} 不渲染任何 UI。
     */
    function CountReader() {
      const ctx = useContext(NotificationContext);
      useEffect(() => {
        capturedCount = ctx.unreadCount;
      }, [ctx.unreadCount]);
      return null;
    }

    renderWithProviders(<CountReader />, { user: mockUser });

    act(() => {
      emitUnread(fakeNotifications(3));
    });

    expect(capturedCount).toBe(3);
  });
});

// ===========================================================================
// NotificationBell
// ===========================================================================

describe('NotificationBell', () => {
  it('should NOT render when user is null', () => {
    renderWithProviders(<NotificationBell />, { user: null });

    expect(screen.queryByRole('button', { name: /通知/ })).not.toBeInTheDocument();
  });

  it('should render bell button when user logged in', () => {
    renderWithProviders(<NotificationBell />, { user: mockUser });

    expect(screen.getByRole('button', { name: /通知/ })).toBeInTheDocument();
  });

  it('should NOT show badge when unreadCount is 0', () => {
    renderWithProviders(<NotificationBell />, { user: mockUser });

    act(() => {
      emitUnread([]);
    });

    expect(screen.queryByText(/\d/)).not.toBeInTheDocument();
  });

  it('should show badge with count', () => {
    renderWithProviders(<NotificationBell />, { user: mockUser });

    act(() => {
      emitUnread(fakeNotifications(5));
    });

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should show 99+ when unreadCount > 99', () => {
    renderWithProviders(<NotificationBell />, { user: mockUser });

    act(() => {
      emitUnread(fakeNotifications(100));
    });

    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('should toggle panel open/close on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationBell />, { user: mockUser });

    const bell = screen.getByRole('button', { name: /通知/ });
    expect(bell).toHaveAttribute('aria-expanded', 'false');

    await user.click(bell);
    expect(bell).toHaveAttribute('aria-expanded', 'true');

    await user.click(bell);
    expect(bell).toHaveAttribute('aria-expanded', 'false');
  });

  it('should show outlined bell when panel closed, filled when open', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationBell />, { user: mockUser });

    const bell = screen.getByRole('button', { name: /通知/ });
    const icon = within(bell).getByRole('img', { name: '通知鈴鐺圖示' });

    // Panel closed → outlined (stroke, no fill)
    expect(icon).toHaveAttribute('data-filled', 'false');

    await user.click(bell);
    expect(icon).toHaveAttribute('data-filled', 'true');
  });
});

// ===========================================================================
// Navbar integration
// ===========================================================================

describe('Navbar integration', () => {
  it('should show NotificationBell between desktopLinks and UserMenu when logged in', () => {
    render(
      <AuthContext.Provider value={{ user: mockUser, setUser: () => {}, loading: false }}>
        <NotificationProvider>
          <Navbar />
        </NotificationProvider>
      </AuthContext.Provider>,
    );

    expect(screen.getByRole('button', { name: /通知/ })).toBeInTheDocument();
  });
});
