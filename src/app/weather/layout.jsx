import { Fraunces } from 'next/font/google';

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
  axes: ['SOFT', 'WONK', 'opsz'],
});

export const metadata = {
  title: '天氣 | Dive Into Run',
  description: '跑步前查看天氣預報，選擇最佳跑步時段。',
};

/**
 * 天氣頁面佈局，載入 Fraunces 字型。
 * @param {object} props - 元件屬性。
 * @param {import('react').ReactNode} props.children - 子頁面內容。
 * @returns {import('react').JSX.Element} 天氣頁面佈局。
 */
export default function WeatherLayout({ children }) {
  return <div className={fraunces.variable}>{children}</div>;
}
