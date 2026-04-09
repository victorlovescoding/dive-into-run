import { fetchEventById } from '@/lib/firebase-events';
import { buildEventOgDescription } from '@/lib/og-helpers';
import EventDetailClient from './eventDetailClient';

const FALLBACK_TITLE = 'Dive Into Run';
const OG_IMAGE_PATH = '/og-default.png';

/**
 * 產生活動詳情頁的 OG / Twitter Card metadata。
 * @param {object} root0 - 頁面屬性。
 * @param {Promise<{ id: string }>} root0.params - 路由參數。
 * @returns {Promise<import('next').Metadata>} 頁面 metadata。
 */
export async function generateMetadata({ params }) {
  const { id } = await params;
  const event = await fetchEventById(id);

  const title = event?.title || FALLBACK_TITLE;
  const description = buildEventOgDescription(event);
  const url = `/events/${id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [OG_IMAGE_PATH],
      url,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [OG_IMAGE_PATH],
    },
  };
}

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
