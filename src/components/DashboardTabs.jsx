'use client';

import useDashboardTabsRuntime from '@/runtime/hooks/useDashboardTabsRuntime';
import DashboardTabsScreen from '@/ui/member/DashboardTabsScreen';

/**
 * 會員 dashboard tabs thin entry。
 * @param {object} props - 元件 props。
 * @param {string} props.uid - 使用者 UID。
 * @returns {import('react').ReactElement} Dashboard tabs。
 */
export default function DashboardTabs({ uid }) {
  const runtime = useDashboardTabsRuntime(uid);

  return <DashboardTabsScreen runtime={runtime} />;
}
