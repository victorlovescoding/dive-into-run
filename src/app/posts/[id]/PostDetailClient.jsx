'use client';

import usePostDetailRuntime from '@/runtime/hooks/usePostDetailRuntime';
import PostDetailScreen from '@/ui/posts/PostDetailScreen';

/**
 * 文章詳情頁 thin client entry。
 * @param {object} props - 元件 props。
 * @param {string} props.postId - 文章 ID。
 * @returns {import('react').ReactElement} 文章詳情頁面。
 */
export default function PostDetailClient({ postId }) {
  const normalizedPostId = String(postId ?? '');
  const runtime = usePostDetailRuntime(normalizedPostId);

  return <PostDetailScreen postId={normalizedPostId} runtime={runtime} />;
}
