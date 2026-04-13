'use client';

import dynamic from 'next/dynamic';

const WeatherPage = dynamic(() => import('@/components/weather/WeatherPage'), { ssr: false });

/**
 * 天氣頁面入口 — 動態載入客戶端天氣元件（避免 Leaflet SSR）。
 * @returns {import('react').JSX.Element} 天氣頁面。
 */
export default function Weather() {
  return <WeatherPage />;
}
