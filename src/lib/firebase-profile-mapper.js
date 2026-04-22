/**
 * @file Shared mapper for public profile documents.
 *
 * Keeps client and server profile normalization in one place so both service
 * entry points return the same shape.
 */

/**
 * @typedef {object} PublicProfile
 * @property {string} uid - 使用者 UID（= Firestore document ID）。
 * @property {string} name - 顯示名稱。
 * @property {string} photoURL - 頭像 URL，可能為空字串。
 * @property {string} [bio] - 個人簡介（0–150 字），未設定時 undefined。
 * @property {import('firebase/firestore').Timestamp} createdAt - 加入平台日期。
 */

/**
 * 將 Firestore document data 正規化成共享的 `PublicProfile` shape。
 * @param {string} uid - 使用者 UID（fallback 用，data 內若有 uid 會優先使用）。
 * @param {Record<string, unknown>} data - Firestore document data。
 * @returns {PublicProfile} 正規化後的 PublicProfile 物件。
 */
export function toPublicProfile(uid, data) {
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
