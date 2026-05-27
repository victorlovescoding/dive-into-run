/**
 * @typedef {'followers' | 'following'} FollowListType
 * @typedef {object} FollowListRow
 * @property {string} uid - Row user uid.
 * @property {string} name - Display name.
 * @property {string} photoURL - Avatar URL.
 * @property {string} [bio] - Bio excerpt source text.
 */

/**
 * Reads a uid from a follow mirror document, falling back to the doc id.
 * @param {import('firebase/firestore').QueryDocumentSnapshot} snapshot - Follow doc snapshot.
 * @returns {string} Follow row uid.
 */
function getFollowUid(snapshot) {
  const data = /** @type {Record<string, unknown>} */ (snapshot.data() ?? {});
  return typeof data.uid === 'string' && data.uid.length > 0 ? data.uid : snapshot.id;
}

/**
 * Maps follow document snapshots to unique row uids while preserving order.
 * @param {import('firebase/firestore').QueryDocumentSnapshot[]} snapshots - Follow docs.
 * @returns {string[]} Ordered unique uids.
 */
export function getFollowDocumentUids(snapshots) {
  const seen = new Set();
  const uids = [];

  snapshots.forEach((snapshot) => {
    const uid = getFollowUid(snapshot);
    if (!seen.has(uid)) {
      seen.add(uid);
      uids.push(uid);
    }
  });

  return uids;
}

/**
 * Builds modal rows from ordered uids and public profile snapshots.
 * @param {object} params - Build params.
 * @param {string[]} params.uids - Ordered user IDs.
 * @param {import('firebase/firestore').DocumentSnapshot[]} params.profileSnapshots - Profile docs.
 * @returns {FollowListRow[]} Modal rows.
 */
export function buildFollowListRows({ uids, profileSnapshots }) {
  const profilesByUid = new Map();
  profileSnapshots.forEach((snapshot) => {
    if (snapshot.exists()) {
      profilesByUid.set(snapshot.id, /** @type {Record<string, unknown>} */ (snapshot.data() ?? {}));
    }
  });

  return uids.map((uid) => {
    const profile = profilesByUid.get(uid) ?? {};
    const name = typeof profile.name === 'string' && profile.name.length > 0 ? profile.name : '未命名跑友';
    const photoURL = typeof profile.photoURL === 'string' ? profile.photoURL : '';
    const bio = typeof profile.bio === 'string' && profile.bio.length > 0 ? profile.bio : undefined;

    /** @type {FollowListRow} */
    const row = { uid, name, photoURL };
    if (bio) {
      row.bio = bio;
    }
    return row;
  });
}

/**
 * Returns the empty state copy for a follow modal.
 * @param {FollowListType} type - List type.
 * @returns {string} Empty text.
 */
export function getFollowListEmptyText(type) {
  return type === 'followers' ? '還沒有粉絲' : '還沒有追蹤任何跑友';
}
