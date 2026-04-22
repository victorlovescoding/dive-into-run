/**
 * @file 公開檔案 (Public Profile) 服務層 — client SDK 版本。
 * 封裝公開檔案頁面所需的所有 Firestore 查詢，UI 元件僅可透過此模組存取資料。
 *
 * 設計重點：
 * 1. `getUserProfile` 永遠排除 email 欄位以避免 PII 外洩（FR-007 公開讀取）。
 * 2. `getProfileStats` 用 `Promise.all` 並行三項查詢以避免 waterfall。
 * 3. `getHostedEvents` 使用 `limit(pageSize + 1)` 偵測 `hasMore`，回傳的
 *    `lastDoc` 是截斷後的最後一筆，避免下一頁重複載入第 (pageSize+1) 筆。
 * 4. `updateUserBio` 在 client 層先檢查長度，避免無謂的 Firestore round-trip。
 *    Security rules 仍會做相同檢查作為最後防線。
 */

import {
  doc,
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDoc,
  getDocs,
  getCountFromServer,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/config/client/firebase-client';
import { toPublicProfile } from '@/lib/firebase-profile-mapper';

/**
 * @typedef {import('@/lib/firebase-profile-mapper').PublicProfile} PublicProfile
 */

/**
 * @typedef {object} ProfileStats
 * @property {number} hostedCount - 主辦活動數量。
 * @property {number} joinedCount - 參加活動數量（透過 collectionGroup 計算）。
 * @property {number | null} totalDistanceKm - 累計跑步公里數；
 *   未連結 Strava 時為 `null`，已連結但無紀錄時為 `0`。
 */

/**
 * @typedef {object} HostedEventsPage
 * @property {import('@/lib/firebase-events').EventData[]} items - 活動列表。
 * @property {import('firebase/firestore').QueryDocumentSnapshot | null} lastDoc - 分頁游標，
 *   下次呼叫 `getHostedEvents` 時可傳入 `options.lastDoc` 取下一頁。
 * @property {boolean} hasMore - 是否還有下一頁可載入。
 */

/**
 * 取得使用者的公開檔案資料。
 *
 * 設計：使用 client SDK，可被瀏覽器端 component 直接呼叫。需要 SSR 場景請改用
 * `firebase-profile-server.js` 的 `getUserProfileServer`。
 * @param {string} uid - 目標使用者 UID。
 * @returns {Promise<PublicProfile | null>} 使用者公開資料；文件不存在時為 `null`。
 * @throws {Error} 當 `uid` 為空字串。
 */
export async function getUserProfile(uid) {
  if (!uid) throw new Error('uid is required');

  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  return toPublicProfile(uid, /** @type {Record<string, unknown>} */ (snap.data() ?? {}));
}

/**
 * 計算使用者的主辦活動數量。
 * @param {string} uid - 目標使用者 UID。
 * @returns {Promise<number>} 主辦活動數量。
 */
async function fetchHostedCount(uid) {
  const q = query(collection(db, 'events'), where('hostUid', '==', uid));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

/**
 * 計算使用者參加的活動數量（透過 collectionGroup 跨所有 events 查詢）。
 * @param {string} uid - 目標使用者 UID。
 * @returns {Promise<number>} 參加活動數量。
 */
async function fetchJoinedCount(uid) {
  const q = query(collectionGroup(db, 'participants'), where('uid', '==', uid));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

/**
 * 取得使用者的公開檔案統計數據。
 *
 * 目前只跑 hostedCount 與 joinedCount 兩條查詢（`events` 與 `collectionGroup
 * ('participants')` 都對外開放 read）。累計跑步公里數（`totalDistanceKm`）
 * 暫時**固定回 `null`** — Strava 公開展示功能還沒正式實作，且既有的
 * `stravaActivities` rule 只允許本人讀（跨使用者會 permission denied），
 * client SDK 的 aggregate 也需要新的 composite index。等 Strava 公開展示
 * 功能正式啟動時，再重新實作這條查詢（屆時要在 Admin SDK aggregate /
 * denormalize / 只給本人看 三個方案中擇一）。
 *
 * `ProfileStats` 元件層既有的 `totalDistanceKm === null → 隱藏` 分支會
 * 自動吸收這個 null，UI 上不會顯示公里數區塊，與「未連結 Strava」的
 * 視覺行為一致。
 * @param {string} uid - 目標使用者 UID。
 * @returns {Promise<ProfileStats>} 三項統計數據（totalDistanceKm 固定 null）。
 * @throws {Error} 當 `uid` 為空字串。
 */
export async function getProfileStats(uid) {
  if (!uid) throw new Error('uid is required');

  const [hostedCount, joinedCount] = await Promise.all([
    fetchHostedCount(uid),
    fetchJoinedCount(uid),
  ]);

  return { hostedCount, joinedCount, totalDistanceKm: null };
}

/**
 * 分頁取得使用者主辦的活動列表（依活動時間 desc 排序）。
 *
 * 採 `limit(pageSize + 1)` 多撈一筆來判定 `hasMore`，再截斷回 `pageSize` 筆，
 * 並把截斷後的最後一筆當作 `lastDoc` cursor，避免下一頁重複載入第 (pageSize+1) 筆。
 * @param {string} uid - 目標使用者 UID。
 * @param {object} [options] - 分頁選項。
 * @param {import('firebase/firestore').QueryDocumentSnapshot | null} [options.lastDoc] - 上一頁的最後一筆 snapshot。
 * @param {number} [options.pageSize] - 每頁筆數，預設 5。
 * @returns {Promise<HostedEventsPage>} 分頁結果（含 items、lastDoc、hasMore）。
 * @throws {Error} 當 `uid` 為空字串。
 */
export async function getHostedEvents(uid, options = {}) {
  if (!uid) throw new Error('uid is required');

  const { lastDoc = null, pageSize = 5 } = options;

  /** @type {import('firebase/firestore').QueryConstraint[]} */
  const constraints = [where('hostUid', '==', uid), orderBy('time', 'desc')];
  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }
  constraints.push(limit(pageSize + 1));

  const q = query(collection(db, 'events'), ...constraints);
  const snap = await getDocs(q);
  const { docs } = snap;

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
 *
 * Client 層先驗證長度（trim 後 ≤ 150 字）以避免無謂的 Firestore round-trip；
 * Security rules 仍會做相同檢查作為最後防線。空字串被允許並視為「清除既有簡介」。
 * @param {string} uid - 使用者 UID。
 * @param {string} bio - 簡介內容（trim 後 ≤ 150 字）。
 * @returns {Promise<void>}
 * @throws {Error} 當 `uid` 為空，或 trim 後 bio 超過 150 字。
 */
export async function updateUserBio(uid, bio) {
  if (!uid) throw new Error('uid is required');

  const trimmed = (bio ?? '').trim();
  if (trimmed.length > 150) {
    throw new Error('簡介不得超過 150 字');
  }

  await setDoc(doc(db, 'users', uid), { bio: trimmed }, { merge: true });
}
