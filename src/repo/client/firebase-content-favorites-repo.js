import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/config/client/firebase-client';

/**
 * Writes a content favorite document.
 * @param {string} uid - Favorite owner UID.
 * @param {string} favoriteCollectionName - Owner subcollection name.
 * @param {string} targetId - Target post or event ID.
 * @param {{ targetId: string, createdAt: unknown }} payload - Favorite document payload.
 * @returns {Promise<void>} Resolves after the favorite is written.
 */
export async function setFavoriteDocument(uid, favoriteCollectionName, targetId, payload) {
  await setDoc(doc(db, 'users', String(uid), favoriteCollectionName, String(targetId)), payload);
}

/**
 * Deletes a content favorite document.
 * @param {string} uid - Favorite owner UID.
 * @param {string} favoriteCollectionName - Owner subcollection name.
 * @param {string} targetId - Target post or event ID.
 * @returns {Promise<void>} Resolves after the favorite is deleted.
 */
export async function deleteFavoriteDocument(uid, favoriteCollectionName, targetId) {
  await deleteDoc(doc(db, 'users', String(uid), favoriteCollectionName, String(targetId)));
}

/**
 * Fetches owner favorite documents sorted by newest favorite first.
 * @param {string} uid - Favorite owner UID.
 * @param {string} favoriteCollectionName - Owner subcollection name.
 * @returns {Promise<import('firebase/firestore').QueryDocumentSnapshot[]>} Favorite docs.
 */
export async function fetchFavoriteDocuments(uid, favoriteCollectionName) {
  const snapshot = await getDocs(
    query(
      collection(db, 'users', String(uid), favoriteCollectionName),
      orderBy('createdAt', 'desc'),
    ),
  );

  return snapshot.docs;
}

/**
 * Fetches favorite documents for specific target IDs.
 * @param {string} uid - Favorite owner UID.
 * @param {string} favoriteCollectionName - Owner subcollection name.
 * @param {string[]} targetIds - Target post or event IDs.
 * @returns {Promise<import('firebase/firestore').DocumentSnapshot[]>} Favorite snapshots.
 */
export async function fetchFavoriteDocumentsForTargetIds(uid, favoriteCollectionName, targetIds) {
  const ids = Array.from(new Set(targetIds.map(String)));

  return Promise.all(
    ids.map((targetId) =>
      getDoc(doc(db, 'users', String(uid), favoriteCollectionName, targetId)),
    ),
  );
}

/**
 * Fetches latest target documents for the provided IDs.
 * @param {string} targetCollectionName - Top-level target collection name.
 * @param {string[]} targetIds - Target post or event IDs.
 * @returns {Promise<import('firebase/firestore').DocumentSnapshot[]>} Target snapshots.
 */
export async function fetchTargetDocuments(targetCollectionName, targetIds) {
  return Promise.all(
    targetIds.map((targetId) => getDoc(doc(db, targetCollectionName, String(targetId)))),
  );
}
