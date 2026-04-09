import { createContext } from 'react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
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
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={width} height={height} {...props} />
  ),
}));

const mockUsePathname = vi.fn(() => '/events');
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

/** @type {import('react').Context<{ user: object | null, loading: boolean }>} */
const MockAuthContext = createContext({ user: null, loading: false });

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: MockAuthContext,
}));

const mockSignIn = vi.fn();
const mockSignOut = vi.fn();
vi.mock('@/lib/firebase-auth-helpers', () => ({
  signInWithGoogle: (...args) => mockSignIn(...args),
  signOutUser: (...args) => mockSignOut(...args),
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

    it('hamburger contains 3 span elements for lines', async () => {
      // Arrange & Act
      await renderNavbar();

      // Assert
      const btn = screen.getByRole('button', { name: '開啟導覽選單' });
      const spans = btn.querySelectorAll('span');
      expect(spans).toHaveLength(3);
    });
  });

  // T006: Drawer panel + overlay
  describe('T006: Drawer panel + overlay', () => {
    it('drawer dialog exists with correct attributes', async () => {
      // Arrange & Act
      await renderNavbar();

      // Assert
      const drawer = document.getElementById('mobile-drawer');
      expect(drawer).toBeInTheDocument();
      expect(drawer).toHaveAttribute('role', 'dialog');
      expect(drawer).toHaveAttribute('aria-modal', 'true');
      expect(drawer).toHaveAttribute('aria-label', '導覽選單');
    });

    it('drawer is not in open state initially', async () => {
      // Arrange & Act
      await renderNavbar();

      // Assert
      const drawer = document.getElementById('mobile-drawer');
      expect(drawer.className).not.toMatch(/drawerOpen/);
    });

    it('clicking hamburger opens drawer and shows overlay', async () => {
      // Arrange
      const { user } = await renderAndOpenDrawer();

      // Assert
      const drawer = document.getElementById('mobile-drawer');
      expect(drawer.className).toMatch(/drawerOpen/);
    });

    it('drawer shows all 5 nav links after opening', async () => {
      // Arrange & Act
      await renderAndOpenDrawer();

      // Assert
      const drawer = document.getElementById('mobile-drawer');
      const links = within(drawer).getAllByRole('link');
      const labels = ['回首頁', '會員頁面', '文章', '揪團頁面', '跑步'];
      for (const label of labels) {
        expect(within(drawer).getByRole('link', { name: label })).toBeInTheDocument();
      }
    });

    it('active link has aria-current="page"', async () => {
      // Arrange & Act
      await renderAndOpenDrawer();

      // Assert
      const drawer = document.getElementById('mobile-drawer');
      const activeLink = within(drawer).getByRole('link', { name: '揪團頁面' });
      expect(activeLink).toHaveAttribute('aria-current', 'page');
    });

    it('non-active links do NOT have aria-current', async () => {
      // Arrange & Act
      await renderAndOpenDrawer();

      // Assert
      const drawer = document.getElementById('mobile-drawer');
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
      const drawer = document.getElementById('mobile-drawer');
      const loginBtn = within(drawer).getByRole('button', { name: /登入/i });
      expect(loginBtn).toBeInTheDocument();
    });

    it('clicking login button calls signInWithGoogle', async () => {
      // Arrange
      const { user } = await renderAndOpenDrawer({ user: null });

      // Act
      const drawer = document.getElementById('mobile-drawer');
      const loginBtn = within(drawer).getByRole('button', { name: /登入/i });
      await user.click(loginBtn);

      // Assert
      expect(mockSignIn).toHaveBeenCalledTimes(1);
    });

    it('shows user name and sign-out button when logged in', async () => {
      // Arrange & Act
      await renderAndOpenDrawer({ user: mockUser });

      // Assert
      const drawer = document.getElementById('mobile-drawer');
      expect(within(drawer).getByText('Test User')).toBeInTheDocument();
      expect(within(drawer).getByRole('button', { name: /登出/i })).toBeInTheDocument();
    });

    it('clicking sign-out calls signOutUser', async () => {
      // Arrange
      const { user } = await renderAndOpenDrawer({ user: mockUser });

      // Act
      const drawer = document.getElementById('mobile-drawer');
      const signOutBtn = within(drawer).getByRole('button', { name: /登出/i });
      await user.click(signOutBtn);

      // Assert
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  // T007: Drawer state management
  describe('T007: Drawer state management', () => {
    it('hamburger aria-expanded becomes "true" when drawer open', async () => {
      // Arrange
      await renderAndOpenDrawer();

      // Assert — hamburger has aria-controls, drawer close button does not
      const hamburger = document.querySelector('[aria-controls="mobile-drawer"]');
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
      const drawer = document.getElementById('mobile-drawer');
      const closeBtn = within(drawer).getByRole('button', { name: '關閉導覽選單' });
      await user.click(closeBtn);

      // Assert
      expect(document.body.style.overflow).toBe('');
    });

    it('clicking nav link closes drawer', async () => {
      // Arrange
      const { user } = await renderAndOpenDrawer();
      const drawer = document.getElementById('mobile-drawer');

      // Act
      const link = within(drawer).getByRole('link', { name: '文章' });
      await user.click(link);

      // Assert
      expect(drawer.className).not.toMatch(/drawerOpen/);
    });

    it('clicking overlay closes drawer', async () => {
      // Arrange
      const { user } = await renderAndOpenDrawer();

      // Act - find overlay by its class pattern
      const overlay = document.querySelector('[class*="overlay"]');
      await user.click(overlay);

      // Assert
      const drawer = document.getElementById('mobile-drawer');
      expect(drawer.className).not.toMatch(/drawerOpen/);
    });
  });

  // T008: Drawer accessibility
  describe('T008: Drawer accessibility', () => {
    it('close button inside drawer has aria-label "關閉導覽選單"', async () => {
      // Arrange & Act
      await renderAndOpenDrawer();

      // Assert
      const drawer = document.getElementById('mobile-drawer');
      const closeBtn = within(drawer).getByRole('button', { name: '關閉導覽選單' });
      expect(closeBtn).toBeInTheDocument();
    });

    it('pressing Escape closes drawer', async () => {
      // Arrange
      const { user } = await renderAndOpenDrawer();

      // Act
      await user.keyboard('{Escape}');

      // Assert
      const drawer = document.getElementById('mobile-drawer');
      expect(drawer.className).not.toMatch(/drawerOpen/);
    });

    it('focus moves to close button when drawer opens', async () => {
      // Arrange
      const user = userEvent.setup();
      await renderNavbar();

      // Act
      const hamburger = screen.getByRole('button', { name: '開啟導覽選單' });
      await user.click(hamburger);

      // Assert
      const drawer = document.getElementById('mobile-drawer');
      const closeBtn = within(drawer).getByRole('button', { name: '關閉導覽選單' });
      expect(document.activeElement).toBe(closeBtn);
    });

    it('focus returns to hamburger when drawer closes', async () => {
      // Arrange
      const { user } = await renderAndOpenDrawer();

      // Act
      const drawer = document.getElementById('mobile-drawer');
      const closeBtn = within(drawer).getByRole('button', { name: '關閉導覽選單' });
      await user.click(closeBtn);

      // Assert
      const hamburger = screen.getByRole('button', { name: '開啟導覽選單' });
      expect(document.activeElement).toBe(hamburger);
    });
  });
});
