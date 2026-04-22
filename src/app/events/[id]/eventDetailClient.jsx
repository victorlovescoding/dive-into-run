'use client';

import useEventDetailRuntime from '@/runtime/hooks/useEventDetailRuntime';
import EventDetailScreen from '@/ui/events/EventDetailScreen';

/**
 * 活動詳情薄 client entry。
 * @param {object} props - 元件屬性。
 * @param {string} props.id - 活動 ID。
 * @returns {import('react').ReactElement} 詳情頁面。
 */
export default function EventDetailClient({ id }) {
  const normalizedId = String(id);
  const runtime = useEventDetailRuntime(normalizedId);

  return <EventDetailScreen id={normalizedId} runtime={runtime} />;
}
