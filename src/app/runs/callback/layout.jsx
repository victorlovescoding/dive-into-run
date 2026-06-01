import { formatPageTitle, PAGE_TITLES } from '@/runtime/site-metadata';

export const metadata = {
  title: formatPageTitle(PAGE_TITLES.stravaCallback),
};

/**
 * Strava 授權 callback 頁面佈局。
 * @param {object} props - 元件屬性。
 * @param {import('react').ReactNode} props.children - 子頁面內容。
 * @returns {import('react').ReactNode} Strava 授權 callback 頁面內容。
 */
export default function RunsCallbackLayout({ children }) {
  return children;
}
