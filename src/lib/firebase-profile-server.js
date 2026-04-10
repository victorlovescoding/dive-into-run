/**
 * @file 公開檔案 (Public Profile) 服務層 — Firebase Admin SDK 版本（伺服器專用）。
 *
 * 為什麼需要與 client 版本分離：
 * 1. Server Component / `generateMetadata` 在 build/SSR 階段執行，沒有 `window`，
 *    必須走 Admin SDK 並由 service account 鑑權。
 * 2. Client 版本 (`getUserProfile`) 仍保留以支援瀏覽器端 onSnapshot 等互動式查詢。
 *
 * 此檔案 **嚴禁** 被任何 client component 直接 import，否則會把 Admin credentials
 * 帶進 client bundle。建議只在 `app/**\/page.jsx` (Server Component) 或 Route
 * Handler 中使用。
 */

import { adminDb } from '@/lib/firebase-admin';

/**
 * @typedef {import('@/lib/firebase-profile').PublicProfile} PublicProfile
 */

/**
 * 將 Admin SDK document data 正規化成 `PublicProfile`，刻意排除 email 與其他
 * 私有欄位以避免在公開讀取場景外洩 PII。Shape 必須與 client 版的
 * `getUserProfile` 完全一致，UI 才能無痛在 SSR / CSR 之間切換資料來源。
 * @param {string} uid - 使用者 UID（fallback 用）。
 * @param {Record<string, unknown>} data - Firestore document data。
 * @returns {PublicProfile} 正規化後的 PublicProfile 物件。
 */
function toPublicProfile(uid, data) {
  /** @type {PublicProfile} */
  const profile = {
    uid: /** @type {string} */ (data.uid ?? uid),
    name: /** @type {string} */ (data.name ?? ''),
    photoURL: /** @type {string} */ (data.photoURL ?? ''),
    createdAt: /** @type {import('firebase/firestore').Timestamp} */ (data.createdAt),
  };
  if (typeof data.bio === 'string' && data.bio.length > 0) {
    profile.bio = data.bio;
  }
  return profile;
}

/**
 * 伺服器端取得使用者公開檔案資料。
 *
 * 用途：供 `app/users/[uid]/page.jsx` 的 `generateMetadata` 與 Server Component
 * 在 SSR 階段預先取得 user 資料以產生 OG metadata 與 not-found 處理。
 * @param {string} uid - 目標使用者 UID。
 * @returns {Promise<PublicProfile | null>} 使用者公開資料；文件不存在時為 `null`。
 * @throws {Error} 當 `uid` 為空字串。
 */
// eslint-disable-next-line import/prefer-default-export -- 此檔案是 server-only namespace，預期日後新增更多 admin SDK 查詢函式皆採 named export，與 client 版 firebase-profile.js 保持一致
export async function getUserProfileServer(uid) {
  if (!uid) throw new Error('uid is required');

  const snap = await adminDb.collection('users').doc(uid).get();
  // Admin SDK 的 `exists` 是 property，不是 method（client SDK 才是 method）
  if (!snap.exists) return null;

  return toPublicProfile(uid, /** @type {Record<string, unknown>} */ (snap.data() ?? {}));
}
