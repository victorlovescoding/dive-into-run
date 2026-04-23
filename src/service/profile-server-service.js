import getUserProfileDocument from '@/repo/server/firebase-profile-server-repo';
import { toPublicProfile } from '@/service/profile-mapper';

/**
 * @typedef {import('@/service/profile-mapper').PublicProfile} PublicProfile
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
async function getUserProfileServer(uid) {
  if (!uid) throw new Error('uid is required');

  const userData = await getUserProfileDocument(uid);
  if (!userData) return null;

  return toPublicProfile(uid, userData);
}

export { getUserProfileServer };
export default getUserProfileServer;
