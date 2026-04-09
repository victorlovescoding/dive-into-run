/**
 * @typedef {object} NavItem
 * @property {string} href - 路由路徑。
 * @property {string} label - 顯示文字。
 */

/** @type {NavItem[]} */
const NAV_ITEMS = [
  { href: '/', label: '回首頁' },
  { href: '/member', label: '會員頁面' },
  { href: '/posts', label: '文章' },
  { href: '/events', label: '揪團頁面' },
  { href: '/runs', label: '跑步' },
];

/**
 * 判斷導覽連結是否為目前頁面。
 * @param {string} pathname - 目前路由路徑。
 * @param {string} href - 導覽連結路徑。
 * @returns {boolean} 是否為 active 狀態。
 */
function isActivePath(pathname, href) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

export { NAV_ITEMS, isActivePath };
