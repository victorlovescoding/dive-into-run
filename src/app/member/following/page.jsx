'use client';

import useMemberFollowingRuntime from '@/runtime/hooks/useMemberFollowingRuntime';
import MemberFollowingScreen from '@/ui/member/MemberFollowingScreen';

/** @returns {import('react').ReactElement} Member following page entry. */
export default function MemberFollowingPage() {
  const runtime = useMemberFollowingRuntime();
  return <MemberFollowingScreen runtime={runtime} />;
}
