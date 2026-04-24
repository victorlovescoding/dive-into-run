'use client';
import { Suspense } from 'react';
import usePostsPageRuntime from '@/runtime/hooks/usePostsPageRuntime';
import PostsPageScreen from '@/ui/posts/PostsPageScreen';
/** @returns {import('react').ReactElement} Suspense 內層 posts screen。 */
function PostsPageContent() {
  const runtime = usePostsPageRuntime();
  return <PostsPageScreen runtime={runtime} />;
}
/** @returns {import('react').ReactElement} posts page thin entry。 */
export default function PostPage() {
  return (
    <Suspense>
      <PostsPageContent />
    </Suspense>
  );
}
