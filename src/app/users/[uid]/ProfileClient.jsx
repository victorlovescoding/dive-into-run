'use client';
import useProfileRuntime from '@/runtime/hooks/useProfileRuntime';
import FollowListModal from '@/ui/users/FollowListModal';
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
  return (
    <ProfileScreen
      runtime={runtime}
      header={<ProfileHeader user={runtime.headerUser} runtime={runtime} />}
      statsSection={
        runtime.stats && !runtime.isStatsLoading && !runtime.statsError ? (
          <ProfileStats
            stats={runtime.stats}
            onOpenFollowers={() => runtime.openFollowModal('followers')}
            onOpenFollowing={() => runtime.openFollowModal('following')}
          />
        ) : null
      }
      eventList={<ProfileEventList uid={runtime.profileUid} />}
      followModal={
        <FollowListModal
          isOpen={Boolean(runtime.followModal.type)}
          title={runtime.followModal.title}
          rows={runtime.followModal.rows}
          loading={runtime.followModal.loading}
          loadingMore={runtime.followModal.loadingMore}
          error={runtime.followModal.error}
          hasMore={runtime.followModal.hasMore}
          emptyText={runtime.followModal.emptyText}
          onClose={runtime.closeFollowModal}
          onRetry={() => runtime.followModal.type && runtime.openFollowModal(runtime.followModal.type)}
          onLoadMore={runtime.loadMoreFollowModal}
        />
      }
    />
  );
}
