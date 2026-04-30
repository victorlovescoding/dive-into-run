import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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
  onSnapshot: vi.fn(() => vi.fn()),
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

import { NotificationContext } from '@/runtime/providers/NotificationProvider';
import NotificationPanel from '@/components/Notifications/NotificationPanel';
import NotificationItem from '@/components/Notifications/NotificationItem';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    actorPhotoURL: 'https://example.com/photo.jpg',
    entityType: 'event',
    entityId: 'evt1',
    entityTitle: '週末跑步',
    commentId: null,
    message: '你所參加的『週末跑步』活動資訊有更動',
    read: false,
    createdAt: {
      toDate: () => new Date(Date.now() - 5 * 60 * 1000),
      toMillis: () => Date.now() - 5 * 60 * 1000,
    },
    ...overrides,
  });
}

/**
 * 建立 NotificationContext 預設 mock value。
 * @param {Partial<import('@/runtime/providers/NotificationProvider').NotificationContextValue>} [overrides] - 覆寫欄位。
 * @returns {import('@/runtime/providers/NotificationProvider').NotificationContextValue} mock context value。
 */
function createContextValue(overrides = {}) {
  return {
    unreadCount: 0,
    notifications: [],
    isPanelOpen: true,
    togglePanel: vi.fn(),
    closePanel: vi.fn(),
    markAsRead: vi.fn(),
    activeTab: 'all',
    setActiveTab: vi.fn(),
    hasMore: false,
    isLoadingMore: false,
    hasLoadedMore: false,
    loadMore: vi.fn(),
    currentToast: null,
    bellButtonRef: /** @type {import('react').RefObject<HTMLButtonElement | null>} */ ({
      current: null,
    }),
    ...overrides,
  };
}

/**
 * 用 NotificationContext.Provider 包裹 NotificationPanel 渲染。
 * @param {object} [options] - 渲染選項。
 * @param {import('@/lib/notification-helpers').NotificationItem[]} [options.notifications] - 通知列表。
 * @param {boolean} [options.isPanelOpen] - 面板是否開啟。
 * @param {import('vitest').Mock} [options.closePanel] - 關閉面板 mock。
 * @returns {import('@testing-library/react').RenderResult} render 結果。
 */
function renderPanel({ notifications = [], isPanelOpen = true, closePanel = vi.fn() } = {}) {
  return render(
    <NotificationContext.Provider
      value={createContextValue({
        unreadCount: notifications.filter((n) => !n.read).length,
        notifications,
        isPanelOpen,
        closePanel,
      })}
    >
      <NotificationPanel />
    </NotificationContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// NotificationPanel
// ===========================================================================

describe('NotificationPanel', () => {
  it('should render when isPanelOpen is true', () => {
    renderPanel({ isPanelOpen: true });

    expect(screen.getByRole('region', { name: '通知面板' })).toBeInTheDocument();
  });

  it('should NOT render when isPanelOpen is false', () => {
    renderPanel({ isPanelOpen: false });

    expect(screen.queryByRole('region', { name: '通知面板' })).not.toBeInTheDocument();
  });

  it('should show up to 5 notifications', () => {
    const notifications = Array.from({ length: 5 }, (_, i) =>
      createMockNotification({ id: `n${i}`, message: `通知 ${i}` }),
    );

    renderPanel({ notifications });

    const panel = screen.getByRole('region', { name: '通知面板' });
    const buttons = within(panel).getAllByRole('button');
    expect(buttons).toHaveLength(5);
  });

  it('should show empty state "目前沒有通知" when no notifications', () => {
    renderPanel({ notifications: [] });

    expect(screen.getByText('目前沒有通知')).toBeInTheDocument();
  });

  it('should close on outside click', async () => {
    const user = userEvent.setup();
    const closePanel = vi.fn();

    // 在 panel 外面加一個可點擊的元素
    render(
      <div>
        <button type="button">外面的按鈕</button>
        <NotificationContext.Provider value={createContextValue({ closePanel })}>
          <NotificationPanel />
        </NotificationContext.Provider>
      </div>,
    );

    expect(screen.getByRole('region', { name: '通知面板' })).toBeInTheDocument();

    await user.click(screen.getByText('外面的按鈕'));

    expect(closePanel.mock.calls).toEqual([[]]);
  });

  it('should update list when context notifications change', () => {
    const notifications = [createMockNotification({ id: 'n1', message: '第一則' })];

    const { rerender } = render(
      <NotificationContext.Provider value={createContextValue({ unreadCount: 1, notifications })}>
        <NotificationPanel />
      </NotificationContext.Provider>,
    );

    expect(screen.getByText('第一則')).toBeInTheDocument();

    const updatedNotifications = [
      ...notifications,
      createMockNotification({ id: 'n2', message: '第二則' }),
    ];

    rerender(
      <NotificationContext.Provider
        value={createContextValue({ unreadCount: 2, notifications: updatedNotifications })}
      >
        <NotificationPanel />
      </NotificationContext.Provider>,
    );

    expect(screen.getByText('第一則')).toBeInTheDocument();
    expect(screen.getByText('第二則')).toBeInTheDocument();
  });
});

// ===========================================================================
// NotificationItem
// ===========================================================================

describe('NotificationItem', () => {
  it('should render avatar, message text, and relative time', () => {
    const notification = createMockNotification();
    render(<NotificationItem notification={notification} onClick={vi.fn()} />);

    expect(screen.getByRole('img', { name: 'Test Actor 的頭像' })).toBeInTheDocument();
    expect(screen.getByText('你所參加的『週末跑步』活動資訊有更動')).toBeInTheDocument();
    expect(screen.getByText('5 分鐘前')).toBeInTheDocument();
  });

  it('should show blue dot for unread notification (read=false)', () => {
    const notification = createMockNotification({ read: false });
    render(<NotificationItem notification={notification} onClick={vi.fn()} />);

    expect(screen.getByTestId('notification-unread-dot')).toBeInTheDocument();
  });

  it('should NOT show blue dot for read notification (read=true)', () => {
    const notification = createMockNotification({ read: true });
    render(<NotificationItem notification={notification} onClick={vi.fn()} />);

    expect(screen.queryByTestId('notification-unread-dot')).not.toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const notification = createMockNotification();

    render(<NotificationItem notification={notification} onClick={onClick} />);

    await user.click(screen.getByRole('button'));

    expect(onClick.mock.calls).toHaveLength(1);
    expect(onClick.mock.calls[0][0]).toEqual(expect.objectContaining({ type: 'click' }));
  });

  it('should handle avatar error with fallback', async () => {
    const notification = createMockNotification({ actorPhotoURL: 'https://broken.url/img.jpg' });
    render(<NotificationItem notification={notification} onClick={vi.fn()} />);

    const img = screen.getByRole('img', { name: 'Test Actor 的頭像' });

    img.dispatchEvent(new Event('error'));

    // 圖片消失，應顯示預設頭像（首字）
    await waitFor(() => {
      expect(screen.queryByRole('img', { name: 'Test Actor 的頭像' })).not.toBeInTheDocument();
      expect(screen.getByText('T')).toBeInTheDocument();
    });
  });
});
