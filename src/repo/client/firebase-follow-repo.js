import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/config/client/firebase-client';

/**
 * @typedef {{ path: string }} FollowDocumentReference
 * @typedef {{ get: (ref: FollowDocumentReference) => Promise<{ exists: () => boolean, data: () => object }>, set: (ref: FollowDocumentReference, payload: object) => void, update: (ref: FollowDocumentReference, payload: object) => void, delete: (ref: FollowDocumentReference) => void }} FollowTransaction
 */

/**
 * Reads a numeric count from a transaction snapshot.
 * @param {{ data: () => object }} snapshot - User document snapshot.
 * @param {'followersCount'} field - Count field.
 * @returns {number} Current count.
 */
function readCount(snapshot, field) {
  const data = snapshot.data();
  const value = data[field];
  return typeof value === 'number' ? value : 0;
}

/**
 * Applies a count delta with a zero floor.
 * @param {number} currentCount - Current count.
 * @param {number} delta - Count delta.
 * @returns {number} Next count.
 */
function nextCount(currentCount, delta) {
  return Math.max(0, currentCount + delta);
}

/**
 * Creates mirrored follow documents and updates public counts transactionally.
 * @param {object} params - Follow transaction params.
 * @param {string} params.followerUid - Follower UID.
 * @param {string} params.targetUid - Target UID.
 * @param {object} params.payload - Mirrored follow document payload.
 * @returns {Promise<{ following: boolean, stateChanged: boolean }>} Follow result.
 */
export async function followRunnerRelationship({ followerUid, targetUid, payload }) {
  return runTransaction(db, async (transaction) => {
    const followingRef = doc(db, 'users', followerUid, 'following', targetUid);
    const followerRef = doc(db, 'users', targetUid, 'followers', followerUid);
    const targetUserRef = doc(db, 'users', targetUid);
    const existingFollow = await transaction.get(followingRef);
    const targetUser = await transaction.get(targetUserRef);

    if (existingFollow.exists()) {
      return { following: true, stateChanged: false };
    }

    transaction.set(followingRef, payload);
    transaction.set(followerRef, payload);
    transaction.update(targetUserRef, {
      followersCount: nextCount(readCount(targetUser, 'followersCount'), 1),
    });

    return { following: true, stateChanged: true };
  });
}

/**
 * Deletes mirrored follow documents and updates public counts transactionally.
 * @param {object} params - Unfollow transaction params.
 * @param {string} params.followerUid - Follower UID.
 * @param {string} params.targetUid - Target UID.
 * @returns {Promise<{ following: boolean, stateChanged: boolean }>} Unfollow result.
 */
export async function unfollowRunnerRelationship({ followerUid, targetUid }) {
  return runTransaction(db, async (transaction) => {
    const followingRef = doc(db, 'users', followerUid, 'following', targetUid);
    const followerRef = doc(db, 'users', targetUid, 'followers', followerUid);
    const targetUserRef = doc(db, 'users', targetUid);
    const existingFollow = await transaction.get(followingRef);
    const targetUser = await transaction.get(targetUserRef);

    if (!existingFollow.exists()) {
      return { following: false, stateChanged: false };
    }

    transaction.delete(followingRef);
    transaction.delete(followerRef);
    transaction.update(targetUserRef, {
      followersCount: nextCount(readCount(targetUser, 'followersCount'), -1),
    });

    return { following: false, stateChanged: true };
  });
}

/**
 * Reads whether a user follows a target.
 * @param {string} followerUid - Follower UID.
 * @param {string} targetUid - Target UID.
 * @returns {Promise<boolean>} Whether the relationship exists.
 */
export async function fetchFollowStatus(followerUid, targetUid) {
  const snapshot = await getDoc(doc(db, 'users', followerUid, 'following', targetUid));
  return snapshot.exists();
}

/**
 * Reads follow documents for a public user list.
 * @param {string} uid - Public profile UID.
 * @param {'followers'|'following'} direction - List direction.
 * @returns {Promise<Array<{ id: string, data: () => object }>>} Follow document snapshots.
 */
export async function fetchFollowDocuments(uid, direction) {
  const snapshot = await getDocs(
    query(collection(db, 'users', uid, direction), orderBy('createdAt', 'desc')),
  );
  return snapshot.docs;
}

/**
 * Derives a user's public following count from the following subcollection.
 * @param {string} uid - Public profile UID.
 * @returns {Promise<number>} Number of users followed by this profile.
 */
export async function fetchDerivedFollowingCount(uid) {
  const snapshot = await getDocs(collection(db, 'users', uid, 'following'));
  return snapshot.size;
}
