'use client';

import useProfileEventsRuntime from '@/runtime/hooks/useProfileEventsRuntime';
import ProfileEventListScreen from '@/ui/users/ProfileEventListScreen';

/**
 * 主辦活動列表 thin wrapper — 串接 runtime hook 與 UI screen。
 * @param {object} props - Component props。
 * @param {string} props.uid - 目標使用者 UID。
 * @returns {import('react').ReactElement} 主辦活動列表。
 */
export default function ProfileEventList({ uid }) {
  const runtime = useProfileEventsRuntime(uid);
  return <ProfileEventListScreen runtime={runtime} />;
}
