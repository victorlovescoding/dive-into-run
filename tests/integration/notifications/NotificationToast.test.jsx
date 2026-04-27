import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

vi.mock('@/config/client/firebase-client', () => ({
  auth: {},
  db: {},
  provider: {},
}));

vi.mock('@/lib/firebase-users', () => ({
  loginCheckUserData: vi.fn(),
  watchUserProfile: vi.fn(),
}));

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

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

import { AuthContext } from '@/runtime/providers/AuthProvider';
import NotificationProvider from '@/runtime/providers/NotificationProvider';
import NotificationToast from '@/components/Notifications/NotificationToast';
import NotificationBell from '@/components/Notifications/NotificationBell';
import {
  watchNotifications,
  watchUnreadNotifications,
} from '@/runtime/client/use-cases/notification-use-cases';

let notificationsCallback;
let notificationsOnNew;
let unreadCallback;
const mockUnsubscribe = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();

  /** @type {import('vitest').Mock} */ (watchNotifications).mockImplementation(
    (uid, onNext, onError, onNew) => {
      notificationsCallback = onNext;
      notificationsOnNew = onNew;
      return mockUnsubscribe;
    },
  );
  /** @type {import('vitest').Mock} */ (watchUnreadNotifications).mockImplementation(
    (uid, onNext) => {
      unreadCallback = onNext;
      return mockUnsubscribe;
    },
  );
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
  it('新通知到來時顯示 toast', async () => {
    // Arrange
    renderWithProviders();
    act(() => {
      notificationsCallback([], null);
      unreadCallback([]);
    });

    // Act
    act(() => {
      notificationsOnNew([{ id: 'n1', message: '新通知訊息' }]);
    });

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('新通知訊息');
  });

  it('toast 約 5 秒後自動消失', async () => {
    // Arrange
    renderWithProviders();
    act(() => {
      notificationsCallback([], null);
      unreadCallback([]);
    });

    // Act
    act(() => {
      notificationsOnNew([{ id: 'n1', message: '即將消失' }]);
    });
    expect(screen.getByRole('status')).toHaveTextContent('即將消失');

    // Assert
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('面板開啟時不顯示 toast', () => {
    // Arrange
    renderWithProviders();
    act(() => {
      notificationsCallback([], null);
      unreadCallback([]);
    });

    // Act — 點擊鈴鐺開啟面板
    fireEvent.click(screen.getByRole('button', { name: /通知/ }));

    act(() => {
      notificationsOnNew([{ id: 'n1', message: '不應顯示' }]);
    });

    // Assert
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('初始載入不觸發 toast', () => {
    // Arrange & Act
    renderWithProviders();
    act(() => {
      notificationsCallback([{ id: 'n1', message: '初始通知', read: false }], null);
      unreadCallback([{ id: 'n1', message: '初始通知', read: false }]);
    });

    // Assert — onNew 不會在初始載入時被呼叫，所以沒有 toast
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('多則通知依序顯示（一次一則）', () => {
    // Arrange
    renderWithProviders();
    act(() => {
      notificationsCallback([], null);
      unreadCallback([]);
    });

    // Act — 同時送兩則通知
    act(() => {
      notificationsOnNew([
        { id: 'n1', message: '第一則' },
        { id: 'n2', message: '第二則' },
      ]);
    });

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
