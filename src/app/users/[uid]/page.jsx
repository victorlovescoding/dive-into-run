import { notFound } from 'next/navigation';
import { getUserProfileServer } from '@/service/profile-server-service';
import ProfileClient from './ProfileClient';
import serializeProfile from './profile-serialization';

/**
 * 公開檔案頁面的 Next.js `generateMetadata` async function。
 *
 * 用途：在 SSR 階段預先抓使用者資料產生 OG / SEO metadata，支援社群平台
 * 分享預覽（FR: 公開檔案需支援 og:title / og:description / og:image）。
 * 使用者不存在時仍回傳 fallback metadata 而非拋錯，避免 404 預覽破版。
 * @param {object} args - Next.js 傳入的 route 參數。
 * @param {Promise<{ uid: string }>} args.params - 路由參數（Next.js 15 起為 Promise）。
 * @returns {Promise<import('next').Metadata>} 頁面 metadata。
 */
export async function generateMetadata({ params }) {
  const { uid } = await params;
  const profile = await getUserProfileServer(uid);

  if (!profile) {
    return {
      title: '找不到使用者 — Dive into Run',
      description: '找不到此使用者的公開檔案。',
    };
  }

  const title = `${profile.name || '使用者'} — Dive into Run`;
  const description = profile.bio || `${profile.name || '使用者'} 的跑步檔案`;
  const images = profile.photoURL ? [{ url: profile.photoURL }] : [];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images,
    },
  };
}

/**
 * 公開檔案頁面 Server Component 入口。
 *
 * 流程：
 * 1. 解析 `params` 取得 uid（Next.js 15 起 `params` 是 Promise）。
 * 2. 透過 Admin SDK 讀 `users/{uid}`。不存在 → `notFound()` 回傳 404。
 * 3. 把 Admin Timestamp 序列化成 Date 後交給 `<ProfileClient>` 做互動邏輯。
 * @param {object} args - Next.js 傳入的 route 參數。
 * @param {Promise<{ uid: string }>} args.params - 路由參數。
 * @returns {Promise<import('react').ReactElement>} 公開檔案頁面 React tree。
 */
export default async function PublicProfilePage({ params }) {
  const { uid } = await params;
  const profile = await getUserProfileServer(uid);

  if (!profile) {
    notFound();
  }

  const serialized = serializeProfile(profile);
  return <ProfileClient user={serialized} />;
}
