'use client';
import useProfileRuntime from '@/runtime/hooks/useProfileRuntime';
import ProfileScreen from '@/ui/users/ProfileScreen';
import ProfileEventList from './ProfileEventList';
import ProfileHeader from './ProfileHeader';
import ProfileStats from './ProfileStats';
/**
 * @param {object} props - Component props。
 * @param {import('@/runtime/hooks/useProfileRuntime').ProfileRuntimeUser} props.user - Server profile prop。
 * @returns {import('react').ReactElement} Profile page。
 */
export default function ProfileClient(props) {
  const runtime = useProfileRuntime(props.user);
  return <ProfileScreen runtime={runtime} header={<ProfileHeader user={runtime.headerUser} />} statsSection={runtime.stats && !runtime.isStatsLoading && !runtime.statsError ? <ProfileStats stats={runtime.stats} /> : null} eventList={<ProfileEventList uid={runtime.profileUid} />} />;
}
