'use client';
import useRunsPageRuntime from '@/runtime/hooks/useRunsPageRuntime';
import RunsPageScreen from '@/ui/runs/RunsPageScreen';
/** @returns {import('react').ReactElement} runs page thin entry。 */
export default function RunsPage() {
  const runtime = useRunsPageRuntime();
  return <RunsPageScreen runtime={runtime} />;
}
