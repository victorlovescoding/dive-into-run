const MEMBER_NAV_HREF = '/member';

/**
 * Returns Navbar items visible for the current auth state.
 * @template {{ href: string }} T
 * @param {T[]} navItems - All configured nav items.
 * @param {{ user: unknown, loading: boolean }} authState - Current auth state.
 * @returns {T[]} Visible nav items.
 */
export default function getVisibleNavItems(navItems, { user, loading }) {
  const canShowMemberLink = !loading && Boolean(user);

  return navItems.filter((item) => item.href !== MEMBER_NAV_HREF || canShowMemberLink);
}
