import { notFound } from 'next/navigation';
import { getUserProfileServer } from '@/lib/firebase-profile-server';
import ProfileClient from './ProfileClient';

/**
 * @typedef {import('@/lib/firebase-profile').PublicProfile} PublicProfile
 */

/**
 * @typedef {object} SerializedPublicProfile
 * @property {string} uid - 使用者 UID。
 * @property {string} name - 顯示名稱。
 * @property {string} photoURL - 頭像 URL。
 * @property {string} [bio] - 個人簡介。
 * @property {Date} createdAt - 加入日期（序列化後的 Date 實例）。
 */

/**
 * 將後端取回的 `PublicProfile` 轉成可跨越 RSC boundary 的純資料結構。
 *
 * 為什麼需要這個步驟：Next.js App Router 規範 Server Component 傳給
 * Client Component 的 props 必須可序列化（Date 支援，但 class instance
 * with methods 例如 Firestore Admin Timestamp 會遺失 `toDate()`）。這裡
 * 明確把 Timestamp 轉成 `Date`，讓 `ProfileClient` 的 `toCreatedAtAdapter`
 * 能以 `instanceof Date` 的分支處理。
 * @param {PublicProfile} profile - Admin SDK 抓到的原始 profile。
 * @returns {SerializedPublicProfile} RSC-safe 的 profile 物件。
 */
function serializeProfile(profile) {
  const createdAtDate =
    typeof profile.createdAt?.toDate === 'function' ? profile.createdAt.toDate() : new Date(0);

  /** @type {SerializedPublicProfile} */
  const base = {
    uid: profile.uid,
    name: profile.name,
    photoURL: profile.photoURL,
    createdAt: createdAtDate,
  };
  if (typeof profile.bio === 'string' && profile.bio.length > 0) {
    base.bio = profile.bio;
  }
  return base;
}

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
