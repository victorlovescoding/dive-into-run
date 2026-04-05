import EventDetailClient from './eventDetailClient';

// Next.js 15+: params 可能是 Promise
/**
 * 活動詳情頁面（伺服器元件），解析路由參數後交給客戶端元件。
 * @param {object} root0 - 頁面屬性。
 * @param {Promise<{ id: string }>} root0.params - 路由參數。
 * @returns {Promise<import('react').JSX.Element>} 活動詳情頁面。
 */
export default async function EventDetailPage({ params }) {
  const { id } = await params;
  return <EventDetailClient id={String(id)} />;
}
