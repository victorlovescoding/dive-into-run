import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
} from 'firebase/firestore';
import { db } from '@/config/client/firebase-client';

/**
 * @typedef {'followers' | 'following'} FollowListType
 * @typedef {import('firebase/firestore').QueryDocumentSnapshot} QueryDocumentSnapshot
 */

/**
 * Reads whether a viewer follows a target user.
 * @param {string} viewerUid - Viewer uid.
 * @param {string} targetUid - Target uid.
 * @returns {Promise<boolean>} Whether the follow document exists.
 */
export async function fetchFollowStatusDocument(viewerUid, targetUid) {
  const snap = await getDoc(doc(db, 'users', viewerUid, 'following', targetUid));
  return snap.exists();
}

/**
 * Fetches a page of follower/following docs sorted newest first.
 * @param {object} params - Query params.
 * @param {string} params.profileUid - Profile owner uid.
 * @param {FollowListType} params.type - List type.
 * @param {QueryDocumentSnapshot | null} [params.lastDoc] - Previous page cursor.
 * @param {number} [params.pageSize] - Page size.
 * @returns {Promise<QueryDocumentSnapshot[]>} Follow document snapshots.
 */
export async function fetchFollowDocumentsPage({
  profileUid,
  type,
  lastDoc = null,
  pageSize = 20,
}) {
  /** @type {import('firebase/firestore').QueryConstraint[]} */
  const constraints = [orderBy('createdAt', 'desc')];
  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }
  constraints.push(limit(pageSize + 1));

  const snap = await getDocs(query(collection(db, 'users', profileUid, type), ...constraints));
  return snap.docs;
}

/**
 * Fetches public profile documents for a set of user IDs.
 * @param {string[]} uids - User IDs.
 * @returns {Promise<import('firebase/firestore').DocumentSnapshot[]>} Public profile snapshots.
 */
export async function fetchPublicProfileDocuments(uids) {
  return Promise.all(uids.map((uid) => getDoc(doc(db, 'users', uid))));
}

/**
 * Sends a follow/unfollow request through the server API.
 * @param {object} params - Request params.
 * @param {'POST' | 'DELETE'} params.method - HTTP method.
 * @param {string} params.targetUid - Target uid.
 * @param {string} params.idToken - Firebase ID token.
 * @returns {Promise<{ isFollowing: boolean, followersCount: number }>} API response.
 */
export async function requestFollowMutation({ method, targetUid, idToken }) {
  const response = await fetch(`/api/follows/${encodeURIComponent(targetUid)}`, {
    method,
    headers: { Authorization: `Bearer ${idToken}` },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : 'Follow request failed');
  }

  return {
    isFollowing: Boolean(body.isFollowing),
    followersCount: typeof body.followersCount === 'number' ? body.followersCount : 0,
  };
}
