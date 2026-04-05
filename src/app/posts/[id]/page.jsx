import PostDetailClient from './PostDetailClient';

/**
 * 文章詳情頁面（伺服器元件），解析路由參數後交給客戶端元件。
 * @param {object} root0 - 頁面屬性。
 * @param {Promise<{ id: string }>} root0.params - 路由參數。
 * @returns {Promise<import('react').JSX.Element>} 文章詳情頁面。
 */
export default async function PostDetailPage({ params }) {
  const { id } = await params;
  return (
    <div>
      <div>
        Hello 這是詳細頁面(id:
        {id})
      </div>
      <PostDetailClient postId={id} />
    </div>
  );
  // 去資料庫拿資料
}
