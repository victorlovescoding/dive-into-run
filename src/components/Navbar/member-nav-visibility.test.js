import { describe, expect, it } from 'vitest';
import getVisibleNavItems from './member-nav-visibility';

const navItems = [
  { href: '/', label: '首頁' },
  { href: '/events', label: '活動' },
  { href: '/member', label: '會員頁面' },
];

describe('getVisibleNavItems', () => {
  it('hides member navigation while auth is loading', () => {
    const result = getVisibleNavItems(navItems, {
      user: { uid: 'user-1' },
      loading: true,
    });

    expect(result).toEqual([
      { href: '/', label: '首頁' },
      { href: '/events', label: '活動' },
    ]);
  });

  it('hides member navigation after auth settles without a user', () => {
    const result = getVisibleNavItems(navItems, { user: null, loading: false });

    expect(result).toEqual([
      { href: '/', label: '首頁' },
      { href: '/events', label: '活動' },
    ]);
  });

  it('shows member navigation after auth settles with a signed-in user', () => {
    const result = getVisibleNavItems(navItems, {
      user: { uid: 'user-1' },
      loading: false,
    });

    expect(result).toEqual(navItems);
  });
});
