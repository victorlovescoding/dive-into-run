'use client';

import { Suspense } from 'react';
import useStravaCallbackRuntime from '@/runtime/hooks/useStravaCallbackRuntime';
import StravaCallbackScreen from '@/ui/runs/StravaCallbackScreen';

/** @returns {import('react').ReactElement} Suspense 內層 callback screen。 */
function CallbackContent() {
  const runtime = useStravaCallbackRuntime();
  return <StravaCallbackScreen runtime={runtime} />;
}
/** @returns {import('react').ReactElement} callback page thin entry。 */
export default function CallbackPage() {
  return (
    <Suspense
      fallback={<StravaCallbackScreen runtime={{ status: 'loading', message: '載入中...' }} />}
    >
      <CallbackContent />
    </Suspense>
  );
}
