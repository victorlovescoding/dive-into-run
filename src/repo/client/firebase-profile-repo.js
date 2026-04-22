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

/**
 * @typedef {import('firebase/firestore').QueryDocumentSnapshot} QueryDocumentSnapshot
 */

/**
 * 取得使用者公開檔案文件。
 * @param {string} uid - 使用者 UID。
 * @returns {Promise<Record<string, unknown> | null>} 使用者資料或 null。
 */
export async function fetchUserProfileDocument(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? /** @type {Record<string, unknown>} */ (snap.data() ?? {}) : null;
}

/**
 * 計算使用者的主辦活動數量。
 * @param {string} uid - 目標使用者 UID。
 * @returns {Promise<number>} 主辦活動數量。
 */
export async function fetchHostedCount(uid) {
  const q = query(collection(db, 'events'), where('hostUid', '==', uid));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

/**
 * 計算使用者參加的活動數量。
 * @param {string} uid - 目標使用者 UID。
 * @returns {Promise<number>} 參加活動數量。
 */
export async function fetchJoinedCount(uid) {
  const q = query(collectionGroup(db, 'participants'), where('uid', '==', uid));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

/**
 * 分頁取得使用者主辦的活動文件。
 * @param {string} uid - 目標使用者 UID。
 * @param {object} [options] - 分頁選項。
 * @param {QueryDocumentSnapshot | null} [options.lastDoc] - 上一頁最後一筆 snapshot。
 * @param {number} [options.pageSize] - 每頁筆數。
 * @returns {Promise<{ docs: QueryDocumentSnapshot[], lastDoc: QueryDocumentSnapshot | null }>} 分頁結果。
 */
export async function fetchHostedEventDocumentsPage(uid, options = {}) {
  const { lastDoc = null, pageSize = 5 } = options;

  /** @type {import('firebase/firestore').QueryConstraint[]} */
  const constraints = [where('hostUid', '==', uid), orderBy('time', 'desc')];
  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }
  constraints.push(limit(pageSize + 1));

  const snap = await getDocs(query(collection(db, 'events'), ...constraints));

  return {
    docs: snap.docs,
    lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
  };
}

/**
 * 更新使用者個人簡介（bio）。
 * @param {string} uid - 使用者 UID。
 * @param {string} bio - 要寫入的 bio。
 * @returns {Promise<void>}
 */
export async function updateUserBioDocument(uid, bio) {
  await setDoc(doc(db, 'users', uid), { bio }, { merge: true });
}
