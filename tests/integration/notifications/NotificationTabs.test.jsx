import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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
import NotificationProvider from '@/runtime/providers/NotificationProvider';
import NotificationPanel from '@/components/Notifications/NotificationPanel';
import NotificationBell from '@/components/Notifications/NotificationBell';
import {
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

/** @type {((items: import('@/lib/notification-helpers').NotificationItem[]) => void) | undefined} */
let notificationsCallback;
/** @type {((items: import('@/lib/notification-helpers').NotificationItem[]) => void) | undefined} */
let unreadCallback;
const mockUnsubscribe = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  notificationsCallback = undefined;
  unreadCallback = undefined;

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
  it('should have「全部」tab selected by default', async () => {
    // Arrange
    const user = userEvent.setup();
    renderPanel();

    // Act — open panel
    await user.click(screen.getByRole('button', { name: '通知' }));

    // 送入通知資料
    act(() => {
      notificationsCallback?.([createNotification('n1')]);
      unreadCallback?.([createNotification('n1')]);
    });

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
    act(() => {
      notificationsCallback?.([
        createNotification('n1', false),
        createNotification('n2', true),
        createNotification('n3', false),
      ]);
      unreadCallback?.([createNotification('n1', false), createNotification('n3', false)]);
    });

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
    act(() => {
      notificationsCallback?.([createNotification('n1', true), createNotification('n2', true)]);
      unreadCallback?.([]);
    });

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

    act(() => {
      notificationsCallback?.([createNotification('n1', false), createNotification('n2', false)]);
      unreadCallback?.([createNotification('n1', false), createNotification('n2', false)]);
    });

    // 切到未讀 tab
    await user.click(screen.getByRole('tab', { name: '未讀' }));

    // Act — 點擊第一則通知（觸發 markAsRead → optimistic update）
    const notificationButtons = screen.getAllByRole('button', { name: /通知/ });
    // 排除 tab buttons — 只保留通知項目 button
    const itemButtons = notificationButtons.filter((btn) => btn.getAttribute('role') !== 'tab');
    await user.click(itemButtons[0]);

    // Assert — n1 應從列表消失（optimistic update 把它從 unreadNotifications 移除）
    expect(screen.queryByText('通知 n1')).not.toBeInTheDocument();
  });

  it('should have correct a11y structure for tabs', async () => {
    // Arrange
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: '通知' }));

    act(() => {
      notificationsCallback?.([]);
      unreadCallback?.([]);
    });

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
