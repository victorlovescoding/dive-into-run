import { getPostDetail } from '@/lib/firebase-posts';
import { buildPostOgDescription } from '@/lib/og-helpers';
import { formatPageTitle, PAGE_TITLES, SITE_NAME } from '@/runtime/site-metadata';
import PostDetailClient from './PostDetailClient';

const OG_IMAGE_PATH = '/og-default.png';

/**
 * 產生文章詳情頁的 OG / Twitter Card metadata。
 * @param {object} root0 - 頁面屬性。
 * @param {Promise<{ id: string }>} root0.params - 路由參數。
 * @returns {Promise<import('next').Metadata>} 頁面 metadata。
 */
export async function generateMetadata({ params }) {
  const { id } = await params;
  const post = await getPostDetail(id);

  const title = formatPageTitle(post?.title || PAGE_TITLES.post);
  const socialTitle = post?.title || SITE_NAME;
  const description = buildPostOgDescription(post);
  const url = `/posts/${id}`;

  return {
    title,
    description,
    openGraph: {
      title: socialTitle,
      description,
      images: [OG_IMAGE_PATH],
      url,
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: [OG_IMAGE_PATH],
    },
  };
}

/**
 * 文章詳情頁面（伺服器元件），解析路由參數後交給客戶端元件。
 * @param {object} root0 - 頁面屬性。
 * @param {Promise<{ id: string }>} root0.params - 路由參數。
 * @returns {Promise<import('react').JSX.Element>} 文章詳情頁面。
 */
export default async function PostDetailPage({ params }) {
  const { id } = await params;
  return <PostDetailClient postId={id} />;
}
