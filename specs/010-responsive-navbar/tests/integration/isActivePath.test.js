import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}));

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: { _currentValue: { user: null, loading: false } },
}));

vi.mock('@/components/Notifications/NotificationBell', () => ({
  default: () => null,
}));

vi.mock('@/components/Notifications/NotificationPanel', () => ({
  default: () => null,
}));

vi.mock('@/lib/firebase-auth-helpers', () => ({
  signInWithGoogle: vi.fn(),
  signOutUser: vi.fn(),
}));

import { isActivePath } from '@/components/Navbar/Navbar';

describe('isActivePath', () => {
  it('returns true when pathname is "/" and href is "/"', () => {
    expect(isActivePath('/', '/')).toBe(true);
  });

  it('returns false for non-root pathname when href is "/" (exact match only)', () => {
    expect(isActivePath('/events', '/')).toBe(false);
  });

  it('returns true when pathname exactly matches href', () => {
    expect(isActivePath('/events', '/events')).toBe(true);
  });

  it('returns true when pathname is a sub-path of href', () => {
    expect(isActivePath('/events/123', '/events')).toBe(true);
  });

  it('returns false when pathname does not match href', () => {
    expect(isActivePath('/posts', '/events')).toBe(false);
  });

  it('returns true for member exact match', () => {
    expect(isActivePath('/member', '/member')).toBe(true);
  });
});
