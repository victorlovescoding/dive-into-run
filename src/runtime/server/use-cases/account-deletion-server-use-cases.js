import {
  ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS,
  getAccountDeletionScheduledDate,
} from '@/config/account-deletion';
import verifyFirebaseIdToken from '@/repo/server/firebase-auth-admin-repo';
import {
  cancelAccountDeletionRequest,
  createAccountDeletionRequest,
  finalizeDueAccountDeletions,
  getAccountDeletionStatus,
} from '@/repo/server/account-deletion-server-repo';

/* eslint-disable jsdoc/require-jsdoc -- route helpers are internal; exported handlers document behavior. */

/**
 * @typedef {object} AccountDeletionRouteResult
 * @property {number} status - HTTP status code.
 * @property {Record<string, unknown>} body - JSON response body.
 */

function getBearerToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice(7);
}

async function verifyAuthRequest(request) {
  const token = getBearerToken(request);
  if (!token) {
    return { uid: null, decoded: null };
  }

  try {
    const decoded = await verifyFirebaseIdToken(token);
    return { uid: decoded.uid, decoded };
  } catch {
    return { uid: null, decoded: null };
  }
}

function hasRecentAuthentication(decodedToken) {
  const authTime = decodedToken?.auth_time;
  if (typeof authTime !== 'number') {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds - authTime <= ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS;
}

async function getAccountDeletionRouteResult(request) {
  const { uid } = await verifyAuthRequest(request);
  if (!uid) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  return {
    status: 200,
    body: await getAccountDeletionStatus(uid),
  };
}

async function requestAccountDeletionRouteResult(request) {
  const { uid, decoded } = await verifyAuthRequest(request);
  if (!uid) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  if (!hasRecentAuthentication(decoded)) {
    return { status: 403, body: { error: 'Recent sign-in required' } };
  }

  const scheduledFor = getAccountDeletionScheduledDate();
  const result = await createAccountDeletionRequest(uid, scheduledFor);

  if (result.result === 'user_missing') {
    return { status: 404, body: { error: 'User profile not found' } };
  }

  if (result.result === 'already_pending') {
    return {
      status: 409,
      body: { error: 'Account deletion already pending', request: result.request },
    };
  }

  return {
    status: 201,
    body: {
      success: true,
      request: result.request,
    },
  };
}

async function cancelAccountDeletionRouteResult(request) {
  const { uid } = await verifyAuthRequest(request);
  if (!uid) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  const result = await cancelAccountDeletionRequest(uid);

  if (result.result === 'missing') {
    return { status: 404, body: { error: 'Account deletion request not found' } };
  }

  if (result.result === 'finalizing') {
    return { status: 409, body: { error: 'Account deletion is already finalizing' } };
  }

  return { status: 200, body: { success: true } };
}

export {
  getAccountDeletionRouteResult,
  requestAccountDeletionRouteResult,
  cancelAccountDeletionRouteResult,
  finalizeDueAccountDeletions,
};
