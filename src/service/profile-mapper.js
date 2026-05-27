/**
 * @file Shared mapper for public profile documents.
 *
 * Keeps client and server profile normalization in one place so both service
 * entry points return the same shape.
 */

import {
  ACCOUNT_DELETION_STATUS_ACTIVE,
  isPendingDeletionAccount,
} from '@/config/account-deletion';

/**
 * @typedef {object} PublicProfile
 * @property {string} uid - 使用者 UID（= Firestore document ID）。
 * @property {string} name - 顯示名稱。
 * @property {string} photoURL - 頭像 URL，可能為空字串。
 * @property {string} [bio] - 個人簡介（0–150 字），未設定時 undefined。
 * @property {import('firebase/firestore').Timestamp} createdAt - 加入平台日期。
 * @property {number} followersCount - 粉絲數，舊資料缺值時為 0。
 * @property {number} followingCount - 追蹤中數，舊資料缺值時為 0。
 * @property {'public' | string} privacy - 隱私狀態，缺值時視為 public。
 * @property {string} accountStatus - 帳號狀態。
 */

/**
 * Reads a non-negative integer counter with legacy-doc fallback.
 * @param {unknown} value - Counter candidate.
 * @returns {number} Non-negative integer counter.
 */
function toNonNegativeCounter(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

/**
 * 將 Firestore document data 正規化成共享的 `PublicProfile` shape。
 * @param {string} uid - 使用者 UID（fallback 用，data 內若有 uid 會優先使用）。
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
    followersCount: toNonNegativeCounter(data.followersCount),
    followingCount: toNonNegativeCounter(data.followingCount),
    privacy: typeof data.privacy === 'string' ? data.privacy : 'public',
    accountStatus:
      typeof data.accountStatus === 'string'
        ? data.accountStatus
        : ACCOUNT_DELETION_STATUS_ACTIVE,
  };

  if (typeof data.bio === 'string' && data.bio.length > 0) {
    profile.bio = data.bio;
  }

  return profile;
}

/**
 * Checks whether a profile should be visible publicly.
 * @param {Record<string, unknown> | null | undefined} data - Profile document data.
 * @returns {boolean} Whether public profile routes should expose it.
 */
function isPublicProfileVisible(data) {
  const accountStatus =
    typeof data?.accountStatus === 'string' ? data.accountStatus : undefined;
  return !isPendingDeletionAccount(accountStatus);
}

export { isPublicProfileVisible, toPublicProfile };
export default toPublicProfile;
