'use client';
import useProfileRuntime from '@/runtime/hooks/useProfileRuntime';
import ProfileScreen from '@/ui/users/ProfileScreen';
import FollowButton from '@/components/FollowButton';
import FollowListModal from './FollowListModal';
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
  return (
    <ProfileScreen
      runtime={runtime}
      header={<ProfileHeader user={runtime.headerUser} />}
      followControl={
        runtime.followControl.isVisible ? (
          <FollowButton
            isFollowing={runtime.followControl.isFollowing}
            isPending={runtime.followControl.isPending}
            label={runtime.followControl.label}
            onToggle={runtime.followControl.onToggle}
          />
        ) : null
      }
      statsSection={
        runtime.stats && !runtime.isStatsLoading && !runtime.statsError ? (
          <ProfileStats
            stats={runtime.stats}
            followersCount={runtime.followCounts.followersCount}
            followingCount={runtime.followCounts.followingCount}
            onOpenFollowers={runtime.followListModal.open}
            onOpenFollowing={runtime.followListModal.open}
          />
        ) : null
      }
      toastMessage={runtime.toastMessage}
      modal={
        <FollowListModal
          isOpen={runtime.followListModal.isOpen}
          title={runtime.followListModal.title}
          rows={runtime.followListModal.rows}
          isLoading={runtime.followListModal.isLoading}
          error={runtime.followListModal.error}
          onClose={runtime.followListModal.close}
        />
      }
      eventList={<ProfileEventList uid={runtime.profileUid} />}
    />
  );
}
