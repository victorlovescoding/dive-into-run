/**
 * @typedef {import('@/service/profile-mapper').PublicProfile} PublicProfile
 */

/**
 * @typedef {object} SerializedPublicProfile
 * @property {string} uid - 使用者 UID。
 * @property {string} name - 顯示名稱。
 * @property {string} photoURL - 頭像 URL。
 * @property {string} [bio] - 個人簡介。
 * @property {Date} createdAt - 加入日期（序列化後的 Date 實例）。
 * @property {number} [followersCount] - 公開追蹤者數量。
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
export default function serializeProfile(profile) {
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
  const { followersCount } = /** @type {{ followersCount?: unknown }} */ (profile);
  if (typeof followersCount === 'number') {
    base.followersCount = followersCount;
  }
  return base;
}
