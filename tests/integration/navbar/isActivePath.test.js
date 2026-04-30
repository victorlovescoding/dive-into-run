import { describe, it, expect } from 'vitest';
import { isActivePath } from '@/components/Navbar/nav-constants';

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
