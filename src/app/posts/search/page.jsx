'use client';

import { Suspense } from 'react';
import usePostsSearchPageRuntime from '@/runtime/hooks/usePostsSearchPageRuntime';
import PostsSearchPageScreen from '@/ui/posts/PostsSearchPageScreen';

/** @returns {import('react').ReactElement} Suspense 內層 posts search screen。 */
function PostsSearchPageContent() {
  const runtime = usePostsSearchPageRuntime();
  return <PostsSearchPageScreen runtime={runtime} />;
}

/** @returns {import('react').ReactElement} posts search page thin entry。 */
export default function PostsSearchPage() {
  return (
    <Suspense>
      <PostsSearchPageContent />
    </Suspense>
  );
}
