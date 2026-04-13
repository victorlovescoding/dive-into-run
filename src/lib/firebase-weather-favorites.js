import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

/**
 * 新增天氣收藏地點。重複 (countyCode+townshipCode) 則 no-op。
 * @param {string} uid - 使用者 UID。
 * @param {object} location - 收藏地點。
 * @param {string} location.countyCode - 縣市代碼。
 * @param {string} location.countyName - 縣市名。
 * @param {string | null} location.townshipCode - 鄉鎮代碼。
 * @param {string | null} location.townshipName - 鄉鎮名。
 * @param {string | null} [location.displaySuffix] - 龜山島後綴。
 * @returns {Promise<string>} 新文件 ID，或已存在文件 ID。
 */
export async function addFavorite(uid, location) {
  const { countyCode, townshipCode } = location;
  const colRef = collection(db, 'users', uid, 'weatherFavorites');

  // Check duplicate
  const conditions = [where('countyCode', '==', countyCode)];
  if (townshipCode) {
    conditions.push(where('townshipCode', '==', townshipCode));
  } else {
    conditions.push(where('townshipCode', '==', null));
  }
  const q = query(colRef, ...conditions);
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    return snapshot.docs[0].id; // no-op, return existing
  }

  const docRef = await addDoc(colRef, {
    countyCode: location.countyCode,
    countyName: location.countyName,
    townshipCode: location.townshipCode ?? null,
    townshipName: location.townshipName ?? null,
    displaySuffix: location.displaySuffix ?? null,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

/**
 * 移除天氣收藏地點。
 * @param {string} uid - 使用者 UID。
 * @param {string} docId - Firestore 文件 ID。
 * @returns {Promise<void>}
 */
export async function removeFavorite(uid, docId) {
  const docRef = doc(db, 'users', uid, 'weatherFavorites', docId);
  await deleteDoc(docRef);
}

/**
 * 取得使用者所有天氣收藏地點（按 createdAt 降序）。
 * @param {string} uid - 使用者 UID。
 * @returns {Promise<Array<{id: string, countyCode: string, countyName: string, townshipCode: string | null, townshipName: string | null, displaySuffix: string | null, createdAt: import('firebase/firestore').Timestamp}>>}
 */
export async function getFavorites(uid) {
  const colRef = collection(db, 'users', uid, 'weatherFavorites');
  const q = query(colRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

/**
 * 檢查地點是否已收藏。
 * @param {string} uid - 使用者 UID。
 * @param {string} countyCode - 縣市代碼。
 * @param {string | null} townshipCode - 鄉鎮代碼。
 * @returns {Promise<{favorited: boolean, docId: string | null}>}
 */
export async function isFavorited(uid, countyCode, townshipCode) {
  const colRef = collection(db, 'users', uid, 'weatherFavorites');
  const conditions = [where('countyCode', '==', countyCode)];
  if (townshipCode) {
    conditions.push(where('townshipCode', '==', townshipCode));
  } else {
    conditions.push(where('townshipCode', '==', null));
  }
  const q = query(colRef, ...conditions);
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return { favorited: false, docId: null };
  }
  return { favorited: true, docId: snapshot.docs[0].id };
}
