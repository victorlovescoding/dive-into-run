'use client';

import { Suspense } from 'react';
import EventsPageScreen from '@/ui/events/EventsPageScreen';

/**
 * 揪團跑步主頁面 thin entry。
 * @returns {import('react').ReactElement} 頁面組件。
 */
export default function RunTogetherPage() {
  return (
    <Suspense>
      <EventsPageScreen />
    </Suspense>
  );
}
