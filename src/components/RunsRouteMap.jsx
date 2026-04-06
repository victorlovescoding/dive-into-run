import dynamic from 'next/dynamic';

/**
 * 路線地圖元件，以 next/dynamic SSR: false 載入。
 * @param {object} props - 元件 props。
 * @param {string | null | undefined} props.summaryPolyline - Google Encoded Polyline 字串。
 * @returns {import('react').ReactElement} 動態載入的路線地圖。
 */
const RunsRouteMap = dynamic(() => import('@/components/RunsRouteMapInner'), { ssr: false });

export default RunsRouteMap;
