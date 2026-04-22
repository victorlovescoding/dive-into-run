/**
 * @typedef {import('@/lib/firebase-profile-mapper').PublicProfile} PublicProfile
 * @typedef {object} ProfileStats
 * @property {number} hostedCount - 主辦活動數量。
 * @property {number} joinedCount - 參加活動數量（透過 collectionGroup 計算）。
 * @property {number | null} totalDistanceKm - 累計跑步公里數。
 * @typedef {object} HostedEventsPage
 * @property {import('@/lib/firebase-events').EventData[]} items - 活動列表。
 * @property {import('firebase/firestore').QueryDocumentSnapshot | null} lastDoc - 分頁游標。
 * @property {boolean} hasMore - 是否還有下一頁可載入。
 */

import { toPublicProfile } from '@/lib/firebase-profile-mapper';
import {
  fetchHostedCount,
  fetchHostedEventDocumentsPage,
  fetchJoinedCount,
  fetchUserProfileDocument,
  updateUserBioDocument,
} from '@/repo/client/firebase-profile-repo';

/**
 * 取得使用者的公開檔案資料。
 * @param {string} uid - 目標使用者 UID。
 * @returns {Promise<PublicProfile | null>} 使用者公開資料；文件不存在時為 `null`。
 */
export async function getUserProfile(uid) {
  if (!uid) throw new Error('uid is required');

  const data = await fetchUserProfileDocument(uid);
  if (!data) return null;

  return toPublicProfile(uid, data);
}

/**
 * 取得使用者的公開檔案統計數據。
 * @param {string} uid - 目標使用者 UID。
 * @returns {Promise<ProfileStats>} 三項統計數據（totalDistanceKm 固定 null）。
 */
export async function getProfileStats(uid) {
  if (!uid) throw new Error('uid is required');

  const [hostedCount, joinedCount] = await Promise.all([fetchHostedCount(uid), fetchJoinedCount(uid)]);
  return { hostedCount, joinedCount, totalDistanceKm: null };
}

/**
 * 分頁取得使用者主辦的活動列表。
 * @param {string} uid - 目標使用者 UID。
 * @param {object} [options] - 分頁選項。
 * @param {import('firebase/firestore').QueryDocumentSnapshot | null} [options.lastDoc] - 上一頁的最後一筆 snapshot。
 * @param {number} [options.pageSize] - 每頁筆數，預設 5。
 * @returns {Promise<HostedEventsPage>} 分頁結果。
 */
export async function getHostedEvents(uid, options = {}) {
  if (!uid) throw new Error('uid is required');

  const { lastDoc = null, pageSize = 5 } = options;
  const { docs } = await fetchHostedEventDocumentsPage(uid, { lastDoc, pageSize });

  if (docs.length === 0) {
    return { items: [], lastDoc: null, hasMore: false };
  }

  const hasMore = docs.length > pageSize;
  const visibleDocs = hasMore ? docs.slice(0, pageSize) : docs;
  const items = /** @type {import('@/lib/firebase-events').EventData[]} */ (
    visibleDocs.map((d) => ({
      id: d.id,
      .../** @type {object} */ (d.data()),
    }))
  );
  const newLastDoc = visibleDocs[visibleDocs.length - 1] ?? null;

  return {
    items,
    lastDoc: newLastDoc,
    hasMore,
  };
}

/**
 * 更新使用者個人簡介（bio）。
 * @param {string} uid - 使用者 UID。
 * @param {string} bio - 簡介內容（trim 後 ≤ 150 字）。
 * @returns {Promise<void>}
 */
export async function updateUserBio(uid, bio) {
  if (!uid) throw new Error('uid is required');

  const trimmed = (bio ?? '').trim();
  if (trimmed.length > 150) {
    throw new Error('簡介不得超過 150 字');
  }

  await updateUserBioDocument(uid, trimmed);
}
