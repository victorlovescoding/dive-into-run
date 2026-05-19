'use client';

import useMemberFavoritesRuntime from '@/runtime/hooks/useMemberFavoritesRuntime';
import MemberFavoritesScreen from '@/ui/member/MemberFavoritesScreen';

/** @returns {import('react').ReactElement} Member favorites page entry. */
export default function MemberFavoritesPage() {
  const runtime = useMemberFavoritesRuntime();
  return <MemberFavoritesScreen runtime={runtime} />;
}
