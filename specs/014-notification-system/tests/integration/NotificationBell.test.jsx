import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

vi.mock('@/lib/firebase-notifications', () => ({
  watchNotifications: vi.fn(),
  watchUnreadNotifications: vi.fn(),
  markNotificationAsRead: vi.fn(),
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

vi.mock('@/lib/firebase-auth-helpers', () => ({
  signInWithGoogle: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => {
  const { createContext } = require('react');
  /** @type {import('react').Context<import('@/contexts/AuthContext').AuthContextValue>} */
  const AuthContext = createContext({
    user: null,
    setUser: () => {},
    loading: false,
  });
  return {
    AuthContext,
    default: ({ children }) => children,
  };
});

import { watchNotifications, watchUnreadNotifications } from '@/lib/firebase-notifications';
import { AuthContext } from '@/contexts/AuthContext';
import NotificationProvider, { NotificationContext } from '@/contexts/NotificationContext';
import NotificationBell from '@/components/Notifications/NotificationBell';
import Navbar from '@/components/Navbar/Navbar';

const mockedWatchNotifications = /** @type {import('vitest').Mock} */ (watchNotifications);
const mockedWatchUnreadNotifications = /** @type {import('vitest').Mock} */ (
  watchUnreadNotifications
);

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
 * 產生假通知清單。
 * @param {number} count - 通知數量。
 * @param {boolean} [read] - 是否已讀，預設 false。
 * @returns {import('@/lib/notification-helpers').NotificationItem[]} 假通知陣列。
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
  }));
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

/** @type {((notifications: any[]) => void) | undefined} */
let unreadCallback;
const mockUnsubscribeUnread = vi.fn();
const mockUnsubscribeAll = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  unreadCallback = undefined;

  mockedWatchUnreadNotifications.mockImplementation((uid, onNext) => {
    unreadCallback = onNext;
    return mockUnsubscribeUnread;
  });
  mockedWatchNotifications.mockImplementation(() => mockUnsubscribeAll);
});

// ===========================================================================
// NotificationContext
// ===========================================================================

describe('NotificationContext', () => {
  it('should setup listeners on login', () => {
    renderWithProviders(<div />, { user: mockUser });

    expect(mockedWatchUnreadNotifications).toHaveBeenCalledWith(
      'u1',
      expect.any(Function),
      expect.any(Function),
    );
    expect(mockedWatchNotifications).toHaveBeenCalledWith(
      'u1',
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
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

    expect(mockedWatchUnreadNotifications).toHaveBeenCalled();

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
      const ctx = require('react').useContext(NotificationContext);
      capturedCount = ctx.unreadCount;
      return null;
    }

    renderWithProviders(<CountReader />, { user: mockUser });

    act(() => {
      unreadCallback?.(fakeNotifications(3));
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
      unreadCallback?.([]);
    });

    expect(screen.queryByText(/\d/)).not.toBeInTheDocument();
  });

  it('should show badge with count', () => {
    renderWithProviders(<NotificationBell />, { user: mockUser });

    act(() => {
      unreadCallback?.(fakeNotifications(5));
    });

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should show 99+ when unreadCount > 99', () => {
    renderWithProviders(<NotificationBell />, { user: mockUser });

    act(() => {
      unreadCallback?.(fakeNotifications(100));
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
    const svg = bell.querySelector('svg');

    // Panel closed → outlined (stroke, no fill)
    expect(svg).toHaveAttribute('data-filled', 'false');

    await user.click(bell);
    expect(svg).toHaveAttribute('data-filled', 'true');
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
