import verifyFirebaseIdToken from '@/repo/server/firebase-auth-admin-repo';
import {
  createFollowRelationship,
  deleteFollowRelationship,
} from '@/repo/server/firebase-follow-server-repo';

/**
 * @typedef {object} FollowRouteResult
 * @property {number} status - HTTP status code.
 * @property {Record<string, unknown>} body - JSON response body.
 */

/**
 * Extracts a bearer token from a Request.
 * @param {Request} request - Incoming HTTP request.
 * @returns {string | null} Firebase ID token or null when absent/invalid.
 */
function getBearerToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice(7);
}

/**
 * Verifies a Firebase auth bearer token from a Request.
 * @param {Request} request - Incoming HTTP request with Authorization header.
 * @returns {Promise<string | null>} Decoded user uid, or null if invalid/missing.
 */
async function verifyAuthToken(request) {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  try {
    const decoded = await verifyFirebaseIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

/**
 * Normalizes a dynamic route uid param.
 * @param {string} uid - Route uid param.
 * @returns {string} Normalized uid.
 */
function normalizeTargetUid(uid) {
  return String(uid || '').trim();
}

/**
 * Converts a follow repo result to an API response.
 * @param {import('@/repo/server/firebase-follow-server-repo').FollowMutationResult} result - Repo result.
 * @returns {FollowRouteResult} HTTP-like route result.
 */
function toFollowRouteResult(result) {
  if (result.status === 'target_missing') {
    return { status: 404, body: { error: 'Target user not found' } };
  }

  return {
    status: 200,
    body: {
      isFollowing: Boolean(result.isFollowing),
      followersCount: result.followersCount ?? 0,
    },
  };
}

/**
 * Creates or repairs a follow relationship.
 * @param {object} params - Follow params.
 * @param {string} params.viewerUid - Authenticated viewer uid.
 * @param {string} params.targetUid - Target user uid.
 * @returns {Promise<FollowRouteResult>} HTTP-like route result.
 */
async function followRunner({ viewerUid, targetUid }) {
  const normalizedTargetUid = normalizeTargetUid(targetUid);
  if (!normalizedTargetUid) {
    return { status: 400, body: { error: 'Invalid target user' } };
  }

  if (viewerUid === normalizedTargetUid) {
    return { status: 400, body: { error: 'Cannot follow yourself' } };
  }

  const result = await createFollowRelationship({ viewerUid, targetUid: normalizedTargetUid });
  return toFollowRouteResult(result);
}

/**
 * Deletes or repairs a follow relationship.
 * @param {object} params - Unfollow params.
 * @param {string} params.viewerUid - Authenticated viewer uid.
 * @param {string} params.targetUid - Target user uid.
 * @returns {Promise<FollowRouteResult>} HTTP-like route result.
 */
async function unfollowRunner({ viewerUid, targetUid }) {
  const normalizedTargetUid = normalizeTargetUid(targetUid);
  if (!normalizedTargetUid) {
    return { status: 400, body: { error: 'Invalid target user' } };
  }

  if (viewerUid === normalizedTargetUid) {
    return { status: 400, body: { error: 'Cannot follow yourself' } };
  }

  const result = await deleteFollowRelationship({ viewerUid, targetUid: normalizedTargetUid });
  return toFollowRouteResult(result);
}

export { verifyAuthToken, followRunner, unfollowRunner };
