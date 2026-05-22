import { serverTimestamp } from 'firebase/firestore';
import {
  fetchDerivedFollowingCount,
  fetchFollowDocuments,
  fetchFollowStatus,
  followRunnerRelationship,
  unfollowRunnerRelationship,
} from '@/repo/client/firebase-follow-repo';
import {
  buildFollowDocumentPayload,
  normalizeDerivedFollowingCount,
  normalizeFollowDocuments,
  validateFollowPair,
} from '@/service/follow-service';
import { notifyRunnerFollowed } from '@/runtime/client/use-cases/notification-use-cases';

/**
 * Follows another runner and creates a notification only on state transition.
 * @param {object} params - Follow params.
 * @param {{ uid: string, name: string, photoURL: string }} params.follower - Follower profile.
 * @param {{ uid: string, name: string, photoURL: string }} params.target - Target profile.
 * @returns {Promise<{ following: boolean, stateChanged: boolean }>} Follow result.
 */
export async function followRunner({ follower, target }) {
  const { followerUid, targetUid } = validateFollowPair(follower.uid, target.uid);
  const payload = buildFollowDocumentPayload({
    follower,
    target,
    createdAtValue: serverTimestamp(),
  });
  const result = await followRunnerRelationship({
    followerUid,
    targetUid,
    payload,
  });

  if (result.stateChanged) {
    await notifyRunnerFollowed(targetUid, follower);
  }

  return result;
}

/**
 * Unfollows another runner.
 * @param {object} params - Unfollow params.
 * @param {string} params.followerUid - Follower UID.
 * @param {string} params.targetUid - Target UID.
 * @returns {Promise<{ following: boolean, stateChanged: boolean }>} Unfollow result.
 */
export async function unfollowRunner({ followerUid, targetUid }) {
  const pair = validateFollowPair(followerUid, targetUid);
  return unfollowRunnerRelationship(pair);
}

/**
 * Reads whether a user follows a target.
 * @param {object} params - Status params.
 * @param {string} params.followerUid - Follower UID.
 * @param {string} params.targetUid - Target UID.
 * @returns {Promise<boolean>} Whether the relationship exists.
 */
export async function getRunnerFollowStatus({ followerUid, targetUid }) {
  const pair = validateFollowPair(followerUid, targetUid);
  return fetchFollowStatus(pair.followerUid, pair.targetUid);
}

/**
 * Lists public follow rows.
 * @param {object} params - List params.
 * @param {string} params.uid - Public profile UID.
 * @param {'followers'|'following'} params.direction - List direction.
 * @returns {Promise<Array<{ uid: string, name: string, photoURL: string, createdAt: unknown }>>} Public rows.
 */
export async function listRunnerFollows({ uid, direction }) {
  const snapshots = await fetchFollowDocuments(String(uid || '').trim(), direction);
  return normalizeFollowDocuments(snapshots, direction);
}

/**
 * Derives the public following count from the following subcollection.
 * @param {object} params - Count params.
 * @param {string} params.uid - Public profile UID.
 * @returns {Promise<number>} Derived following count.
 */
export async function getRunnerFollowingCount({ uid }) {
  const count = await fetchDerivedFollowingCount(String(uid || '').trim());
  return normalizeDerivedFollowingCount(count);
}
