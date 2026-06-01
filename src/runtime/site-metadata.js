export const SITE_NAME = 'Dive Into Run';

export const PAGE_TITLES = {
  weather: '天氣',
  runs: '跑步紀錄',
  stravaCallback: 'Strava 授權',
  events: '揪團跑步',
  event: '活動',
  posts: '文章河道',
  post: '文章',
  member: '會員中心',
  favorites: '我的收藏',
  user: '使用者',
  userNotFound: '找不到使用者',
};

/**
 * Formats the canonical document title for a page.
 * @param {string} [pageTitle] - Page-specific title text.
 * @returns {string} Canonical Next metadata title.
 */
export function formatPageTitle(pageTitle) {
  return pageTitle ? `${pageTitle} | ${SITE_NAME}` : SITE_NAME;
}

/**
 * Creates metadata with a canonical page title and matching social titles.
 * @param {string} pageTitle - Page-specific title text.
 * @param {string} [description] - Page description.
 * @returns {import('next').Metadata} Canonical page metadata.
 */
export function createPageMetadata(pageTitle, description) {
  const title = formatPageTitle(pageTitle);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    twitter: {
      title,
      description,
    },
  };
}
