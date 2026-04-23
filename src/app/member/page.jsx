'use client';
import DashboardTabs from '@/components/DashboardTabs';
import useMemberPageRuntime from '@/runtime/hooks/useMemberPageRuntime';
import MemberPageScreen from '@/ui/member/MemberPageScreen';
import BioEditor from './BioEditor';
/** @returns {import('react').ReactElement} member page thin entry。 */
export default function MemberPage() {
  const runtime = useMemberPageRuntime();
  const bioEditor = runtime.user ? (
    <BioEditor uid={runtime.user.uid} initialBio={runtime.user.bio ?? ''} />
  ) : null;
  const dashboardTabs = runtime.user ? <DashboardTabs uid={runtime.user.uid} /> : null;
  return <MemberPageScreen runtime={runtime} bioEditor={bioEditor} dashboardTabs={dashboardTabs} />;
}
