/**
 * @file 公開檔案 (Public Profile) 服務層 — server repo + shared mapper 版本。
 *
 * 為什麼需要與 client 版本分離：
 * 1. Server Component / `generateMetadata` 在 build/SSR 階段執行，沒有 `window`，
 *    必須走 server-only repo 來讀取 Firestore。
 * 2. Client 版本 (`getUserProfile`) 仍保留以支援瀏覽器端 onSnapshot 等互動式查詢。
 *
 * 此檔案 **嚴禁** 被任何 client component 直接 import。建議只在
 * `app/**\/page.jsx` (Server Component) 或 Route Handler 中使用。
 */

import getUserProfileDocument from '@/repo/server/firebase-profile-server-repo';
import { toPublicProfile } from '@/lib/firebase-profile-mapper';

/**
 * @typedef {import('@/lib/firebase-profile-mapper').PublicProfile} PublicProfile
 */

/**
 * 伺服器端取得使用者公開檔案資料。
 *
 * 用途：供 `app/users/[uid]/page.jsx` 的 `generateMetadata` 與 Server Component
 * 在 SSR 階段預先取得 user 資料以產生 OG metadata 與 not-found 處理。
 * @param {string} uid - 目標使用者 UID。
 * @returns {Promise<PublicProfile | null>} 使用者公開資料；文件不存在時為 `null`。
 * @throws {Error} 當 `uid` 為空字串。
 */
export async function getUserProfileServer(uid) {
  if (!uid) throw new Error('uid is required');

  const userData = await getUserProfileDocument(uid);
  if (!userData) return null;

  return toPublicProfile(uid, userData);
}
