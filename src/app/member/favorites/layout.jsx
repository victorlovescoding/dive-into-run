import { formatPageTitle, PAGE_TITLES } from '@/runtime/site-metadata';

export const metadata = {
  title: formatPageTitle(PAGE_TITLES.favorites),
};

/**
 * 我的收藏頁面佈局。
 * @param {object} props - 元件屬性。
 * @param {import('react').ReactNode} props.children - 子頁面內容。
 * @returns {import('react').ReactNode} 我的收藏頁面內容。
 */
export default function MemberFavoritesLayout({ children }) {
  return children;
}
