import { createContext } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

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

const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({ replace: mockReplace, push: mockPush })),
}));

/** @type {import('react').Context<{ user: object | null, loading: boolean }>} */
const MockAuthContext = createContext({ user: null, loading: false });

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: MockAuthContext,
}));

vi.mock('@/lib/firebase-auth-helpers', () => ({
  signInWithGoogle: vi.fn(),
  signOutUser: vi.fn(),
}));

describe('Navbar base', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

  /**
   * 動態 import Navbar 元件。
   * @returns {Promise<typeof import('@/components/Navbar/Navbar').default>} Navbar 元件。
   */
  async function importComponent() {
    const mod = await import('@/components/Navbar/Navbar');
    return mod.default;
  }

  it('renders nav element with aria-label "主要導覽"', async () => {
    // Arrange
    const Navbar = await importComponent();

    // Act
    render(<Navbar />);

    // Assert
    const nav = screen.getByRole('navigation', { name: '主要導覽' });
    expect(nav).toBeInTheDocument();
  });

  it('renders brand link "Dive Into Run" pointing to "/"', async () => {
    // Arrange
    const Navbar = await importComponent();

    // Act
    render(<Navbar />);

    // Assert
    const brandLink = screen.getByRole('link', { name: 'Dive Into Run' });
    expect(brandLink).toBeInTheDocument();
    expect(brandLink).toHaveAttribute('href', '/');
  });

  it('renders all 6 nav links with correct labels and hrefs in navbar', async () => {
    // Arrange
    const expectedLinks = [
      { label: '回首頁', href: '/' },
      { label: '會員頁面', href: '/member' },
      { label: '文章', href: '/posts' },
      { label: '揪團頁面', href: '/events' },
      { label: '跑步', href: '/runs' },
      { label: '天氣', href: '/weather' },
    ];
    const Navbar = await importComponent();

    // Act
    render(<Navbar />);

    // Assert — scope to <nav> to avoid duplicate drawer links
    const nav = screen.getByRole('navigation', { name: '主要導覽' });
    for (const { label, href } of expectedLinks) {
      const link = within(nav).getByRole('link', { name: label });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', href);
    }
  });
});
