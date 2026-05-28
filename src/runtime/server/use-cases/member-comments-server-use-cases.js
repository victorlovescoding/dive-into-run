import verifyFirebaseIdToken from '@/repo/server/firebase-auth-admin-repo';
import {
  InvalidMemberCommentsCursorError,
  fetchMemberCommentDocumentsPageByAuthorUid,
} from '@/repo/server/firebase-member-comments-server-repo';

/**
 * @typedef {object} MemberCommentsRouteResult
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
export async function verifyMemberCommentsAuthToken(request) {
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
 * Reads an integer query param.
 * @param {URL} url - Request URL.
 * @param {string} key - Query key.
 * @param {number} fallback - Fallback value.
 * @returns {number} Parsed integer or fallback.
 */
function readIntegerQueryParam(url, key, fallback) {
  const value = Number(url.searchParams.get(key));
  return Number.isFinite(value) ? Math.floor(value) : fallback;
}

/**
 * Loads the authenticated member's comments through the Admin SDK boundary.
 * @param {object} params - Runner params.
 * @param {string} params.uid - Authenticated user uid.
 * @param {URL} params.url - Request URL.
 * @returns {Promise<MemberCommentsRouteResult>} HTTP-like route result.
 */
export async function memberCommentsRunner({ uid, url }) {
  const pageSize = readIntegerQueryParam(url, 'pageSize', 5);
  const afterCursor = url.searchParams.get('cursor') || null;
  let page;
  try {
    page = await fetchMemberCommentDocumentsPageByAuthorUid({
      uid,
      afterCursor,
      pageSize,
    });
  } catch (error) {
    if (error instanceof InvalidMemberCommentsCursorError) {
      return { status: 400, body: { error: 'Invalid cursor' } };
    }
    throw error;
  }

  return {
    status: 200,
    body: {
      documents: page.documents,
      lastDoc: page.lastDoc,
    },
  };
}
