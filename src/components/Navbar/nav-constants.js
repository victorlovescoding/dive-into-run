/**
 * @typedef {object} NavItem
 * @property {string} href - 路由路徑。
 * @property {string} label - 顯示文字。
 */

/** @type {NavItem[]} */
const NAV_ITEMS = [
  { href: '/', label: '回首頁' },
  { href: '/member', label: '會員中心' },
  { href: '/posts', label: '文章' },
  { href: '/events', label: '揪團頁面' },
  { href: '/runs', label: '跑步' },
  { href: '/weather', label: '天氣' },
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

/**
 * 建立登入後使用者選單入口。
 * @param {{ uid: string } | null | undefined} user - 目前登入使用者。
 * @returns {NavItem[]} 登入後使用者選單項目。
 */
function getAuthenticatedMenuItems(user) {
  if (!user?.uid) return [];

  return [
    { href: '/member', label: '會員中心' },
    { href: '/member/favorites', label: '我的收藏' },
    { href: `/users/${user.uid}`, label: '我的公開檔案' },
  ];
}

export { NAV_ITEMS, getAuthenticatedMenuItems, isActivePath };
