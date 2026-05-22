/**
 * Validates a follower-target pair.
 * @param {string} followerUid - User who initiates the follow.
 * @param {string} targetUid - User being followed.
 * @returns {{ followerUid: string, targetUid: string }} Normalized pair.
 */
export function validateFollowPair(followerUid, targetUid) {
  const normalizedFollowerUid = String(followerUid || '').trim();
  const normalizedTargetUid = String(targetUid || '').trim();

  if (!normalizedFollowerUid) {
    throw new Error('Follower uid is required');
  }
  if (!normalizedTargetUid) {
    throw new Error('Target uid is required');
  }
  if (normalizedFollowerUid === normalizedTargetUid) {
    throw new Error('Self follow is not allowed');
  }

  return {
    followerUid: normalizedFollowerUid,
    targetUid: normalizedTargetUid,
  };
}

/**
 * Builds mirrored follow relationship documents.
 * @param {object} params - Follow document params.
 * @param {{ uid: string, name: string, photoURL: string }} params.follower - Follower profile.
 * @param {{ uid: string, name: string, photoURL: string }} params.target - Target profile.
 * @param {unknown} params.createdAtValue - Firestore createdAt value.
 * @returns {object} Shared mirrored document payload.
 */
export function buildFollowDocumentPayload({ follower, target, createdAtValue }) {
  const { followerUid, targetUid } = validateFollowPair(follower.uid, target.uid);

  return {
    followerUid,
    followerName: String(follower.name || ''),
    followerPhotoURL: String(follower.photoURL || ''),
    targetUid,
    targetName: String(target.name || ''),
    targetPhotoURL: String(target.photoURL || ''),
    status: 'following',
    createdAt: createdAtValue,
  };
}

/**
 * Converts Firestore follow snapshots into public list rows.
 * @param {Array<{ id: string, data: () => object }>} snapshots - Follow document snapshots.
 * @param {'followers'|'following'} direction - List direction to normalize.
 * @returns {Array<{ uid: string, name: string, photoURL: string, createdAt: unknown }>} List rows.
 */
export function normalizeFollowDocuments(snapshots, direction) {
  return snapshots.map((snapshot) => {
    const data = snapshot.data();
    const uid = direction === 'followers' ? data.followerUid : data.targetUid;
    const name = direction === 'followers' ? data.followerName : data.targetName;
    const photoURL = direction === 'followers' ? data.followerPhotoURL : data.targetPhotoURL;

    return {
      uid: String(uid || snapshot.id),
      name: String(name || ''),
      photoURL: String(photoURL || ''),
      createdAt: data.createdAt,
    };
  });
}

/**
 * Applies a count delta without allowing negative public counts.
 * @param {unknown} currentCount - Current denormalized count.
 * @param {number} delta - Count delta.
 * @returns {number} Next count.
 */
export function applyFollowCountDelta(currentCount, delta) {
  const count = typeof currentCount === 'number' ? currentCount : 0;
  return Math.max(0, count + delta);
}

/**
 * Normalizes a derived following count from a list or aggregate read.
 * @param {unknown} count - Derived following count candidate.
 * @returns {number} Non-negative following count.
 */
export function normalizeDerivedFollowingCount(count) {
  return typeof count === 'number' && count > 0 ? count : 0;
}
