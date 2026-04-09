import { createContext } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
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
    // eslint-disable-next-line @next/next/no-img-element
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
  email: 'test@example.com',
  photoURL: 'https://example.com/photo.jpg',
};

const mockUserNoPhoto = {
  uid: 'u2',
  name: 'No Photo User',
  email: 'nophoto@example.com',
  photoURL: null,
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

// -- Tests --

describe('Navbar Desktop (T009-T012)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue('/events');

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

  // T009: Desktop horizontal link container
  describe('T009: Desktop links in list', () => {
    it('renders a ul with role="list" containing all 5 nav links as li children', async () => {
      // Arrange & Act
      await renderNavbar();

      // Assert
      const nav = screen.getByRole('navigation', { name: '主要導覽' });
      const list = within(nav).getByRole('list');
      const items = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(5);

      const labels = ['回首頁', '會員頁面', '文章', '揪團頁面', '跑步'];
      for (const label of labels) {
        expect(within(list).getByRole('link', { name: label })).toBeInTheDocument();
      }
    });

    it('active link has aria-current="page" and active class', async () => {
      // Arrange & Act
      await renderNavbar();

      // Assert
      const nav = screen.getByRole('navigation', { name: '主要導覽' });
      const list = within(nav).getByRole('list');
      const activeLink = within(list).getByRole('link', { name: '揪團頁面' });
      expect(activeLink).toHaveAttribute('aria-current', 'page');
      expect(activeLink.className).toMatch(/linkActive/);
    });

    it('non-active links do NOT have aria-current', async () => {
      // Arrange & Act
      await renderNavbar();

      // Assert
      const nav = screen.getByRole('navigation', { name: '主要導覽' });
      const list = within(nav).getByRole('list');
      const homeLink = within(list).getByRole('link', { name: '回首頁' });
      expect(homeLink).not.toHaveAttribute('aria-current');

      const postsLink = within(list).getByRole('link', { name: '文章' });
      expect(postsLink).not.toHaveAttribute('aria-current');
    });
  });

  // T010: Auth UI section
  describe('T010: Auth UI section', () => {
    it('shows skeleton when loading is true', async () => {
      // Arrange & Act
      const { container } = await renderNavbar({ loading: true });

      // Assert
      const skeleton = container.querySelector('[class*="skeleton"]');
      expect(skeleton).toBeInTheDocument();

      // No avatar or login button during loading
      const avatarBtn = container.querySelector('[class*="avatar"]');
      const loginBtns = screen.queryAllByRole('button', { name: /登入/i });
      // Filter to only desktop login buttons (inside nav)
      const nav = screen.getByRole('navigation', { name: '主要導覽' });
      expect(within(nav).queryByRole('button', { name: /登入/i })).not.toBeInTheDocument();
      expect(avatarBtn).not.toBeInTheDocument();
    });

    it('shows login button when logged out', async () => {
      // Arrange & Act
      await renderNavbar({ user: null, loading: false });

      // Assert
      const nav = screen.getByRole('navigation', { name: '主要導覽' });
      const loginBtn = within(nav).getByRole('button', { name: /登入/i });
      expect(loginBtn).toBeInTheDocument();
    });

    it('login button calls signInWithGoogle on click', async () => {
      // Arrange
      const user = userEvent.setup();
      await renderNavbar({ user: null, loading: false });

      // Act
      const nav = screen.getByRole('navigation', { name: '主要導覽' });
      const loginBtn = within(nav).getByRole('button', { name: /登入/i });
      await user.click(loginBtn);

      // Assert
      expect(mockSignIn).toHaveBeenCalledTimes(1);
    });

    it('shows avatar image when logged in with photoURL', async () => {
      // Arrange & Act
      await renderNavbar({ user: mockUser });

      // Assert
      const nav = screen.getByRole('navigation', { name: '主要導覽' });
      const avatarImg = within(nav).getByAltText('使用者頭像');
      expect(avatarImg).toBeInTheDocument();
      expect(avatarImg).toHaveAttribute('src', mockUser.photoURL);
    });

    it('shows SVG fallback when user has no photoURL', async () => {
      // Arrange & Act
      const { container } = await renderNavbar({ user: mockUserNoPhoto });

      // Assert
      const nav = screen.getByRole('navigation', { name: '主要導覽' });
      const avatarBtn = within(nav).getByRole('button', { name: '使用者選單' });
      const svg = avatarBtn.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(within(nav).queryByAltText('使用者頭像')).not.toBeInTheDocument();
    });
  });

  // T011: Avatar dropdown menu
  describe('T011: Avatar dropdown menu', () => {
    it('dropdown opens on avatar click', async () => {
      // Arrange
      const user = userEvent.setup();
      await renderNavbar({ user: mockUser });
      const nav = screen.getByRole('navigation', { name: '主要導覽' });
      const avatarBtn = within(nav).getByRole('button', { name: '使用者選單' });

      // Act
      await user.click(avatarBtn);

      // Assert
      const menu = within(nav).getByRole('menu');
      expect(menu.className).toMatch(/dropdownOpen/);
    });

    it('sign-out button in dropdown calls signOutUser', async () => {
      // Arrange
      const user = userEvent.setup();
      await renderNavbar({ user: mockUser });
      const nav = screen.getByRole('navigation', { name: '主要導覽' });
      const avatarBtn = within(nav).getByRole('button', { name: '使用者選單' });
      await user.click(avatarBtn);

      // Act
      const signOutBtn = within(nav).getByRole('menuitem', { name: /登出/i });
      await user.click(signOutBtn);

      // Assert
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('click outside closes dropdown', async () => {
      // Arrange
      const user = userEvent.setup();
      await renderNavbar({ user: mockUser });
      const nav = screen.getByRole('navigation', { name: '主要導覽' });
      const avatarBtn = within(nav).getByRole('button', { name: '使用者選單' });
      await user.click(avatarBtn);

      // Assert dropdown is open
      const menu = within(nav).getByRole('menu');
      expect(menu.className).toMatch(/dropdownOpen/);

      // Act — click outside
      await user.click(document.body);

      // Assert dropdown closed
      expect(menu.className).not.toMatch(/dropdownOpen/);
    });
  });

  // T012: Dropdown accessibility
  describe('T012: Dropdown accessibility', () => {
    it('avatar button has aria-haspopup="true" and aria-expanded', async () => {
      // Arrange & Act
      await renderNavbar({ user: mockUser });

      // Assert
      const nav = screen.getByRole('navigation', { name: '主要導覽' });
      const avatarBtn = within(nav).getByRole('button', { name: '使用者選單' });
      expect(avatarBtn).toHaveAttribute('aria-haspopup', 'true');
      expect(avatarBtn).toHaveAttribute('aria-expanded', 'false');
    });

    it('avatar aria-expanded becomes "true" when dropdown open', async () => {
      // Arrange
      const user = userEvent.setup();
      await renderNavbar({ user: mockUser });
      const nav = screen.getByRole('navigation', { name: '主要導覽' });
      const avatarBtn = within(nav).getByRole('button', { name: '使用者選單' });

      // Act
      await user.click(avatarBtn);

      // Assert
      expect(avatarBtn).toHaveAttribute('aria-expanded', 'true');
    });

    it('dropdown has role="menu" and sign-out has role="menuitem"', async () => {
      // Arrange
      const user = userEvent.setup();
      await renderNavbar({ user: mockUser });
      const nav = screen.getByRole('navigation', { name: '主要導覽' });
      const avatarBtn = within(nav).getByRole('button', { name: '使用者選單' });

      // Act
      await user.click(avatarBtn);

      // Assert
      const menu = within(nav).getByRole('menu');
      expect(menu).toBeInTheDocument();
      const menuItem = within(menu).getByRole('menuitem', { name: /登出/i });
      expect(menuItem).toBeInTheDocument();
    });

    it('Escape closes dropdown and focuses avatar button', async () => {
      // Arrange
      const user = userEvent.setup();
      await renderNavbar({ user: mockUser });
      const nav = screen.getByRole('navigation', { name: '主要導覽' });
      const avatarBtn = within(nav).getByRole('button', { name: '使用者選單' });
      await user.click(avatarBtn);

      // Act
      await user.keyboard('{Escape}');

      // Assert
      const menu = within(nav).getByRole('menu');
      expect(menu.className).not.toMatch(/dropdownOpen/);
      expect(document.activeElement).toBe(avatarBtn);
    });

    it('focus moves to first menuitem when dropdown opens', async () => {
      // Arrange
      const user = userEvent.setup();
      await renderNavbar({ user: mockUser });
      const nav = screen.getByRole('navigation', { name: '主要導覽' });
      const avatarBtn = within(nav).getByRole('button', { name: '使用者選單' });

      // Act
      await user.click(avatarBtn);

      // Assert
      const menuItem = within(nav).getByRole('menuitem', { name: /登出/i });
      expect(document.activeElement).toBe(menuItem);
    });

    it('focus returns to avatar button when dropdown closes', async () => {
      // Arrange
      const user = userEvent.setup();
      await renderNavbar({ user: mockUser });
      const nav = screen.getByRole('navigation', { name: '主要導覽' });
      const avatarBtn = within(nav).getByRole('button', { name: '使用者選單' });
      await user.click(avatarBtn);

      // Act — close via Escape
      await user.keyboard('{Escape}');

      // Assert
      expect(document.activeElement).toBe(avatarBtn);
    });
  });
});
