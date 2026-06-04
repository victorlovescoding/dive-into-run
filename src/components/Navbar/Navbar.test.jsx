import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/contexts/AuthContext';
import Navbar from './Navbar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/components/Notifications/NotificationBell', () => ({
  default: () => null,
}));

vi.mock('@/components/Notifications/NotificationPanel', () => ({
  default: () => null,
}));

vi.mock('@/runtime/client/use-cases/auth-use-cases', () => ({
  default: vi.fn(() => () => {}),
}));

vi.mock('@/lib/firebase-auth-helpers', () => ({
  signInWithGoogle: vi.fn(),
  signOutUser: vi.fn(),
}));

const signedInUser = {
  uid: 'user-1',
  name: 'Runner One',
  email: 'runner@example.com',
  photoURL: null,
};

/**
 * Renders Navbar with a task-local auth context value.
 * @param {object} authState - Auth state override for the provider.
 * @returns {import('@testing-library/react').RenderResult} Render result.
 */
function renderNavbar(authState) {
  return render(
    <AuthContext.Provider
      value={{
        user: null,
        setUser: vi.fn(),
        loading: false,
        ...authState,
      }}
    >
      <Navbar />
    </AuthContext.Provider>
  );
}

describe('Navbar member navigation visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  it('hides member navigation while auth is loading and keeps public links visible', () => {
    renderNavbar({ user: null, loading: true });

    expect(screen.queryByRole('link', { name: '會員頁面' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '回首頁' }).length).toBeGreaterThan(0);
  });

  it('hides member navigation after auth settles without a user and keeps public links visible', () => {
    renderNavbar({ user: null, loading: false });

    expect(screen.queryByRole('link', { name: '會員頁面' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '回首頁' }).length).toBeGreaterThan(0);
  });

  it('shows member navigation to the member page for a signed-in user', () => {
    renderNavbar({ user: signedInUser, loading: false });

    const memberLinks = screen.getAllByRole('link', { name: '會員頁面' });

    expect(memberLinks.length).toBeGreaterThan(0);
    expect(memberLinks.some((link) => link.getAttribute('href') === '/member')).toBe(true);
    expect(screen.getAllByRole('link', { name: '回首頁' }).length).toBeGreaterThan(0);
  });
});
