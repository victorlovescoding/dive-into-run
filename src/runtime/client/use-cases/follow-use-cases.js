import {
  buildFollowListRows,
  getFollowDocumentUids,
} from '@/service/follow-service';
import {
  fetchFollowDocumentsPage,
  fetchFollowStatusDocument,
  fetchPublicProfileDocuments,
  requestFollowMutation,
} from '@/repo/client/firebase-follow-repo';

const FOLLOW_LIST_PAGE_SIZE = 20;

/**
 * @typedef {'followers' | 'following'} FollowListType
 * @typedef {import('@/service/follow-service').FollowListRow} FollowListRow
 */

/**
 * Returns a required non-empty uid string.
 * @param {unknown} uid - UID candidate.
 * @param {string} label - Error label.
 * @returns {string} Normalized uid.
 */
function requireUid(uid, label) {
  const normalized = String(uid || '').trim();
  if (!normalized) {
    throw new Error(`${label} is required`);
  }
  return normalized;
}

/**
 * Reads whether the current viewer follows the profile owner.
 * @param {object} params - Status params.
 * @param {string | null | undefined} params.viewerUid - Viewer uid.
 * @param {string} params.targetUid - Target uid.
 * @returns {Promise<boolean>} Whether viewer follows target.
 */
export async function getRunnerFollowStatus({ viewerUid, targetUid }) {
  if (!viewerUid || viewerUid === targetUid) {
    return false;
  }

  return fetchFollowStatusDocument(String(viewerUid), requireUid(targetUid, 'targetUid'));
}

/**
 * Follows a runner through the server API.
 * @param {object} params - Follow params.
 * @param {{ getIdToken: () => Promise<string> }} params.currentUser - Current auth user.
 * @param {string} params.targetUid - Target uid.
 * @returns {Promise<{ isFollowing: boolean, followersCount: number }>} API result.
 */
export async function followRunner({ currentUser, targetUid }) {
  const idToken = await currentUser.getIdToken();
  return requestFollowMutation({
    method: 'POST',
    targetUid: requireUid(targetUid, 'targetUid'),
    idToken,
  });
}

/**
 * Unfollows a runner through the server API.
 * @param {object} params - Unfollow params.
 * @param {{ getIdToken: () => Promise<string> }} params.currentUser - Current auth user.
 * @param {string} params.targetUid - Target uid.
 * @returns {Promise<{ isFollowing: boolean, followersCount: number }>} API result.
 */
export async function unfollowRunner({ currentUser, targetUid }) {
  const idToken = await currentUser.getIdToken();
  return requestFollowMutation({
    method: 'DELETE',
    targetUid: requireUid(targetUid, 'targetUid'),
    idToken,
  });
}

/**
 * Loads a page of follower/following modal rows.
 * @param {object} params - Page params.
 * @param {string} params.profileUid - Profile owner uid.
 * @param {FollowListType} params.type - List type.
 * @param {import('firebase/firestore').QueryDocumentSnapshot | null} [params.lastDoc] - Page cursor.
 * @returns {Promise<{ rows: FollowListRow[], lastDoc: import('firebase/firestore').QueryDocumentSnapshot | null, hasMore: boolean }>} Page result.
 */
export async function loadFollowListPage({ profileUid, type, lastDoc = null }) {
  const docs = await fetchFollowDocumentsPage({
    profileUid: requireUid(profileUid, 'profileUid'),
    type,
    lastDoc,
    pageSize: FOLLOW_LIST_PAGE_SIZE,
  });
  const hasMore = docs.length > FOLLOW_LIST_PAGE_SIZE;
  const visibleDocs = hasMore ? docs.slice(0, FOLLOW_LIST_PAGE_SIZE) : docs;
  const uids = getFollowDocumentUids(visibleDocs);
  const profileSnapshots = await fetchPublicProfileDocuments(uids);

  return {
    rows: buildFollowListRows({ uids, profileSnapshots }),
    lastDoc: visibleDocs[visibleDocs.length - 1] ?? null,
    hasMore,
  };
}
