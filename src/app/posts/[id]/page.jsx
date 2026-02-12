import PostDetailClient from './PostDetailClient';

/**
 *
 * @param root0
 * @param root0.params
 */
export default async function PostDetailPage({ params }) {
  const { id } = await params;
  return (
    <div>
      <div>
        Hello 這是詳細頁面(id:
        {id}
        )
      </div>
      <PostDetailClient postId={id} />
    </div>

  );
  // 去資料庫拿資料
}
