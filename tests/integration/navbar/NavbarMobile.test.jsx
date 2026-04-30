import { createContext } from 'react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// -- Mocks --

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, width, height, ...props }) => (
    <img src={src} alt={alt} width={width} height={height} {...props} />
  ),
}));

const mockUsePathname = vi.fn(() => '/events');
const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: vi.fn(() => ({ replace: mockReplace, push: mockPush })),
}));

/** @type {import('react').Context<{ user: object | null, loading: boolean }>} */
const MockAuthContext = createContext({ user: null, loading: false });

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: MockAuthContext,
}));

vi.mock('@/components/Notifications/NotificationBell', () => ({
  default: () => null,
}));

vi.mock('@/components/Notifications/NotificationPanel', () => ({
  default: () => null,
}));

const {
  mockAuth,
  mockProvider,
  mockSignInWithPopup,
  mockSignOut,
} = vi.hoisted(() => ({
  mockAuth: { name: 'mock-auth' },
  mockProvider: { name: 'mock-provider' },
  mockSignInWithPopup: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  signInWithPopup: mockSignInWithPopup,
  signOut: mockSignOut,
}));

vi.mock('@/config/client/firebase-client', () => ({
  auth: mockAuth,
  db: { name: 'mock-db' },
  provider: mockProvider,
}));

// -- Helpers --

const mockUser = {
  uid: 'u1',
  name: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
};

/**
 * 渲染 Navbar 元件並包裹 MockAuthContext Provider。
 * @param {{ user?: object | null, loading?: boolean }} [authValue] - Auth context 值。
 * @returns {Promise<{ container: HTMLElement }>} render 回傳值。
 */
async function renderNavbar(authValue = {}) {
  const { user = null, loading = false } = authValue;
  const mod = await import('@/components/Navbar/Navbar');
  const Navbar = mod.default;
  return render(
    <MockAuthContext.Provider value={{ user, loading }}>
      <Navbar />
    </MockAuthContext.Provider>,
  );
}

/**
 * 開啟 drawer 並回傳 user 實例。
 * @param {{ user?: object | null, loading?: boolean }} [authValue] - Auth context 值。
 * @returns {Promise<{ user: ReturnType<typeof userEvent.setup> }>} userEvent 實例。
 */
async function renderAndOpenDrawer(authValue = {}) {
  const user = userEvent.setup();
  await renderNavbar(authValue);
  const hamburger = screen.getByRole('button', { name: '開啟導覽選單' });
  await user.click(hamburger);
  return { user };
}

// -- Tests --

describe('Navbar Mobile Drawer (T005-T008)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue('/events');
    document.body.style.overflow = '';

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  // T005: Hamburger button
  describe('T005: Hamburger button', () => {
    it('renders hamburger button with correct aria-label', async () => {
      // Arrange & Act
      await renderNavbar();

      // Assert
      const btn = screen.getByRole('button', { name: '開啟導覽選單' });
      expect(btn).toBeInTheDocument();
    });

    it('hamburger has aria-controls pointing to mobile-drawer', async () => {
      // Arrange & Act
      await renderNavbar();

      // Assert
      const btn = screen.getByRole('button', { name: '開啟導覽選單' });
      expect(btn).toHaveAttribute('aria-controls', 'mobile-drawer');
    });

    it('hamburger has aria-expanded="false" when drawer closed', async () => {
      // Arrange & Act
      await renderNavbar();

      // Assert
      const btn = screen.getByRole('button', { name: '開啟導覽選單' });
      expect(btn).toHaveAttribute('aria-expanded', 'false');
    });

    it('hamburger contains 3 aria-hidden line elements', async () => {
      // Arrange & Act
      await renderNavbar();

      // Assert
      const lines = screen.getAllByTestId('hamburger-line');
      expect(lines).toHaveLength(3);
      for (const line of lines) {
        expect(line).toHaveAttribute('aria-hidden', 'true');
      }
    });
  });

  // T006: Drawer panel + overlay
  describe('T006: Drawer panel + overlay', () => {
    it('drawer dialog exists with correct attributes', async () => {
      // Arrange & Act
      await renderNavbar();

      // Assert
      const drawer = screen.getByRole('dialog', { name: '導覽選單' });
      expect(drawer).toBeInTheDocument();
      expect(drawer).toHaveAttribute('role', 'dialog');
      expect(drawer).toHaveAttribute('aria-modal', 'true');
      expect(drawer).toHaveAttribute('aria-label', '導覽選單');
      expect(drawer).toHaveAttribute('id', 'mobile-drawer');
    });

    it('drawer is not in open state initially', async () => {
      // Arrange & Act
      await renderNavbar();

      // Assert
      const drawer = screen.getByRole('dialog', { name: '導覽選單' });
      expect(drawer).not.toHaveClass(/drawerOpen/);
    });

    it('clicking hamburger opens drawer and shows overlay', async () => {
      // Arrange
      await renderAndOpenDrawer();

      // Assert
      const drawer = screen.getByRole('dialog', { name: '導覽選單' });
      const overlay = screen.getByTestId('mobile-drawer-overlay');
      expect(drawer).toHaveClass(/drawerOpen/);
      expect(overlay).toHaveClass(/overlayVisible/);
    });

    it('drawer shows all 6 nav links after opening', async () => {
      // Arrange & Act
      await renderAndOpenDrawer();

      // Assert
      const drawer = screen.getByRole('dialog', { name: '導覽選單' });
      const labels = ['回首頁', '會員頁面', '文章', '揪團頁面', '跑步', '天氣'];
      for (const label of labels) {
        expect(within(drawer).getByRole('link', { name: label })).toBeInTheDocument();
      }
    });

    it('active link has aria-current="page"', async () => {
      // Arrange & Act
      await renderAndOpenDrawer();

      // Assert
      const drawer = screen.getByRole('dialog', { name: '導覽選單' });
      const activeLink = within(drawer).getByRole('link', { name: '揪團頁面' });
      expect(activeLink).toHaveAttribute('aria-current', 'page');
    });

    it('non-active links do NOT have aria-current', async () => {
      // Arrange & Act
      await renderAndOpenDrawer();

      // Assert
      const drawer = screen.getByRole('dialog', { name: '導覽選單' });
      const homeLink = within(drawer).getByRole('link', { name: '回首頁' });
      expect(homeLink).not.toHaveAttribute('aria-current');
    });
  });

  // T006: Auth section
  describe('T006: Auth section in drawer', () => {
    it('shows login button when user is null', async () => {
      // Arrange & Act
      await renderAndOpenDrawer({ user: null });

      // Assert
      const drawer = screen.getByRole('dialog', { name: '導覽選單' });
      const drawerScope = within(drawer);
      const loginBtn = drawerScope.getByRole('button', { name: /登入/i });
      expect(loginBtn).toBeInTheDocument();
    });

    it('clicking login button signs in with Firebase popup', async () => {
      // Arrange
      const { user } = await renderAndOpenDrawer({ user: null });
      mockSignInWithPopup.mockResolvedValueOnce({});

      // Act
      const drawer = screen.getByRole('dialog', { name: '導覽選單' });
      const drawerScope = within(drawer);
      const loginBtn = drawerScope.getByRole('button', { name: /登入/i });
      await user.click(loginBtn);

      // Assert
      expect(mockSignInWithPopup).toHaveBeenCalledWith(mockAuth, mockProvider);
      expect(loginBtn).toBeInTheDocument();
      expect(drawer).toHaveClass(/drawerOpen/);
    });

    it('shows user name and sign-out button when logged in', async () => {
      // Arrange & Act
      await renderAndOpenDrawer({ user: mockUser });

      // Assert
      const drawer = screen.getByRole('dialog', { name: '導覽選單' });
      const drawerScope = within(drawer);
      expect(drawerScope.getByText('Test User')).toBeInTheDocument();
      expect(drawerScope.getByRole('button', { name: /登出/i })).toBeInTheDocument();
    });

    it('clicking sign-out signs out with Firebase auth and closes drawer', async () => {
      // Arrange
      const { user } = await renderAndOpenDrawer({ user: mockUser });
      mockSignOut.mockResolvedValueOnce();

      // Act
      const drawer = screen.getByRole('dialog', { name: '導覽選單' });
      const drawerScope = within(drawer);
      const signOutBtn = drawerScope.getByRole('button', { name: /登出/i });
      await user.click(signOutBtn);

      // Assert
      expect(mockSignOut).toHaveBeenCalledWith(mockAuth);
      expect(drawer).not.toHaveClass(/drawerOpen/);
    });
  });

  // T007: Drawer state management
  describe('T007: Drawer state management', () => {
    it('hamburger aria-expanded becomes "true" when drawer open', async () => {
      // Arrange
      await renderAndOpenDrawer();

      // Assert
      const hamburger = screen.getByRole('button', {
        name: /開啟導覽選單|關閉導覽選單/,
        expanded: true,
      });
      expect(hamburger).toHaveAttribute('aria-expanded', 'true');
    });

    it('body scroll is locked when drawer opens', async () => {
      // Arrange & Act
      await renderAndOpenDrawer();

      // Assert
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('body scroll is restored when drawer closes', async () => {
      // Arrange
      const { user } = await renderAndOpenDrawer();

      // Act — use the close button inside the drawer to avoid ambiguity
      const drawer = screen.getByRole('dialog', { name: '導覽選單' });
      const closeBtn = within(drawer).getByRole('button', { name: '關閉導覽選單' });
      await user.click(closeBtn);

      // Assert
      expect(document.body.style.overflow).toBe('');
    });

    it('clicking nav link closes drawer', async () => {
      // Arrange
      const { user } = await renderAndOpenDrawer();
      const drawer = screen.getByRole('dialog', { name: '導覽選單' });

      // Act
      const link = within(drawer).getByRole('link', { name: '文章' });
      await user.click(link);

      // Assert
      expect(drawer).not.toHaveClass(/drawerOpen/);
    });

    it('clicking overlay closes drawer', async () => {
      // Arrange
      const { user } = await renderAndOpenDrawer();

      // Act
      const overlay = screen.getByTestId('mobile-drawer-overlay');
      await user.click(overlay);

      // Assert
      const drawer = screen.getByRole('dialog', { name: '導覽選單' });
      expect(drawer).not.toHaveClass(/drawerOpen/);
    });
  });

  // T008: Drawer accessibility
  describe('T008: Drawer accessibility', () => {
    it('close button inside drawer has aria-label "關閉導覽選單"', async () => {
      // Arrange & Act
      await renderAndOpenDrawer();

      // Assert
      const drawer = screen.getByRole('dialog', { name: '導覽選單' });
      const closeBtn = within(drawer).getByRole('button', { name: '關閉導覽選單' });
      expect(closeBtn).toBeInTheDocument();
    });

    it('pressing Escape closes drawer', async () => {
      // Arrange
      const { user } = await renderAndOpenDrawer();

      // Act
      await user.keyboard('{Escape}');

      // Assert
      const drawer = screen.getByRole('dialog', { name: '導覽選單' });
      expect(drawer).not.toHaveClass(/drawerOpen/);
    });

    it('focus moves to close button when drawer opens', async () => {
      // Arrange
      const user = userEvent.setup();
      await renderNavbar();

      // Act
      const hamburger = screen.getByRole('button', { name: '開啟導覽選單' });
      await user.click(hamburger);

      // Assert
      const drawer = screen.getByRole('dialog', { name: '導覽選單' });
      const closeBtn = within(drawer).getByRole('button', { name: '關閉導覽選單' });
      expect(closeBtn).toHaveFocus();
    });

    it('focus returns to hamburger when drawer closes', async () => {
      // Arrange
      const { user } = await renderAndOpenDrawer();

      // Act
      const drawer = screen.getByRole('dialog', { name: '導覽選單' });
      const closeBtn = within(drawer).getByRole('button', { name: '關閉導覽選單' });
      await user.click(closeBtn);

      // Assert
      const hamburger = screen.getByRole('button', { name: '開啟導覽選單' });
      expect(hamburger).toHaveFocus();
    });
  });
});
