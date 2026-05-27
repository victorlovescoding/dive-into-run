import { adminDb, createAdminServerTimestamp } from '@/config/server/firebase-admin-app';

/**
 * @typedef {object} FollowMutationResult
 * @property {'ok' | 'target_missing'} status - Domain mutation status.
 * @property {boolean} [isFollowing] - Whether the viewer follows the target after the mutation.
 * @property {number} [followersCount] - Target user's follower count after the mutation.
 */

/**
 * Reads a non-negative counter value from a Firestore document payload.
 * @param {Record<string, unknown>} data - Firestore document data.
 * @param {string} field - Counter field name.
 * @returns {number} Non-negative integer counter value.
 */
function readCounter(data, field) {
  const value = data[field];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

/**
 * Clamps a counter update so it never drops below zero.
 * @param {number} current - Current counter value.
 * @param {number} delta - Counter delta.
 * @returns {number} Updated non-negative counter value.
 */
function applyCounterDelta(current, delta) {
  return Math.max(0, current + delta);
}

/**
 * Builds the exact follow mirror document payload without profile snapshots.
 * @param {object} params - Payload params.
 * @param {string} params.uid - User uid represented by the follow doc.
 * @param {unknown} params.createdAt - Existing createdAt value, if any.
 * @returns {{ uid: string, status: 'accepted', createdAt: unknown }} Follow payload.
 */
function buildFollowPayload({ uid, createdAt }) {
  return {
    uid,
    status: 'accepted',
    createdAt: createdAt || createAdminServerTimestamp(),
  };
}

/**
 * Creates or repairs a public follow relationship.
 * @param {object} params - Mutation params.
 * @param {string} params.viewerUid - Authenticated viewer uid.
 * @param {string} params.targetUid - Target user uid.
 * @returns {Promise<FollowMutationResult>} Mutation result.
 */
export async function createFollowRelationship({ viewerUid, targetUid }) {
  return adminDb.runTransaction(async (transaction) => {
    const viewerRef = adminDb.collection('users').doc(viewerUid);
    const targetRef = adminDb.collection('users').doc(targetUid);
    const followingRef = viewerRef.collection('following').doc(targetUid);
    const followerRef = targetRef.collection('followers').doc(viewerUid);

    const [viewerSnap, targetSnap, followingSnap, followerSnap] = await Promise.all([
      transaction.get(viewerRef),
      transaction.get(targetRef),
      transaction.get(followingRef),
      transaction.get(followerRef),
    ]);

    if (!targetSnap.exists) {
      return { status: 'target_missing' };
    }

    const viewerData = /** @type {Record<string, unknown>} */ (viewerSnap.data() ?? {});
    const targetData = /** @type {Record<string, unknown>} */ (targetSnap.data() ?? {});
    const followingData = /** @type {Record<string, unknown>} */ (followingSnap.data() ?? {});
    const followerData = /** @type {Record<string, unknown>} */ (followerSnap.data() ?? {});
    const followingExists = followingSnap.exists;
    const followerExists = followerSnap.exists;

    const followersCount = applyCounterDelta(
      readCounter(targetData, 'followersCount'),
      followerExists ? 0 : 1,
    );
    const followingCount = applyCounterDelta(
      readCounter(viewerData, 'followingCount'),
      followingExists ? 0 : 1,
    );

    transaction.set(
      followingRef,
      buildFollowPayload({
        uid: targetUid,
        createdAt: followingData.createdAt,
      }),
    );
    transaction.set(
      followerRef,
      buildFollowPayload({
        uid: viewerUid,
        createdAt: followerData.createdAt,
      }),
    );
    transaction.set(targetRef, { followersCount }, { merge: true });
    transaction.set(viewerRef, { followingCount }, { merge: true });

    return { status: 'ok', isFollowing: true, followersCount };
  });
}

/**
 * Deletes or repairs a public follow relationship.
 * @param {object} params - Mutation params.
 * @param {string} params.viewerUid - Authenticated viewer uid.
 * @param {string} params.targetUid - Target user uid.
 * @returns {Promise<FollowMutationResult>} Mutation result.
 */
export async function deleteFollowRelationship({ viewerUid, targetUid }) {
  return adminDb.runTransaction(async (transaction) => {
    const viewerRef = adminDb.collection('users').doc(viewerUid);
    const targetRef = adminDb.collection('users').doc(targetUid);
    const followingRef = viewerRef.collection('following').doc(targetUid);
    const followerRef = targetRef.collection('followers').doc(viewerUid);

    const [viewerSnap, targetSnap, followingSnap, followerSnap] = await Promise.all([
      transaction.get(viewerRef),
      transaction.get(targetRef),
      transaction.get(followingRef),
      transaction.get(followerRef),
    ]);

    if (!targetSnap.exists) {
      return { status: 'target_missing' };
    }

    const viewerData = /** @type {Record<string, unknown>} */ (viewerSnap.data() ?? {});
    const targetData = /** @type {Record<string, unknown>} */ (targetSnap.data() ?? {});
    const followingExists = followingSnap.exists;
    const followerExists = followerSnap.exists;

    const followersCount = applyCounterDelta(
      readCounter(targetData, 'followersCount'),
      followerExists ? -1 : 0,
    );
    const followingCount = applyCounterDelta(
      readCounter(viewerData, 'followingCount'),
      followingExists ? -1 : 0,
    );

    if (followingExists) {
      transaction.delete(followingRef);
    }
    if (followerExists) {
      transaction.delete(followerRef);
    }
    transaction.set(targetRef, { followersCount }, { merge: true });
    if (viewerSnap.exists || followingExists) {
      transaction.set(viewerRef, { followingCount }, { merge: true });
    }

    return { status: 'ok', isFollowing: false, followersCount };
  });
}
