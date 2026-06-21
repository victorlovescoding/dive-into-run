import { createFavoriteLoginContinuationIntent } from '@/runtime/favorites/favorite-login-continuation-helpers';

export const FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS = Object.freeze({
  AUTH_CANCELLED: 'auth-cancelled',
  AUTH_FAILED: 'auth-failed',
  FAVORITE_ADDED: 'favorite-added',
  FAVORITE_ADD_FAILED: 'favorite-add-failed',
});

const AUTH_CANCELLED_CODES = new Set([
  'auth/cancelled-popup-request',
  'auth/popup-closed-by-user',
]);

/**
 * @typedef {import('@/runtime/favorites/favorite-login-continuation-helpers').FavoriteLoginContinuationContentType}
 *   FavoriteLoginContinuationContentType
 * @typedef {{
 *   kind: string,
 *   contentType: FavoriteLoginContinuationContentType,
 *   targetId: string,
 *   uid: string | null,
 *   error?: unknown
 * }} FavoriteLoginContinuationResult
 * @typedef {{
 *   signIn?: () => Promise<unknown>,
 *   addFavorite?: (params: { uid: string, type: FavoriteLoginContinuationContentType, targetId: string }) => Promise<unknown>,
 *   signal?: AbortSignal
 * }} FavoriteLoginContinuationCollaborators
 */

/**
 * Returns a non-empty uid from a Firebase auth result.
 * @param {unknown} authResult - Firebase UserCredential-like result.
 * @returns {string | null} Normalized uid.
 */
function getAuthResultUid(authResult) {
  const uid = /** @type {{ user?: { uid?: unknown } | null }} */ (authResult)?.user?.uid;
  if (typeof uid !== 'string') return null;

  const normalizedUid = uid.trim();
  return normalizedUid || null;
}

/**
 * Returns whether a Google popup error is a user cancellation/close.
 * @param {unknown} error - Auth error.
 * @returns {boolean} Whether the error represents user cancellation.
 */
function isCancelledAuthError(error) {
  const code = /** @type {{ code?: unknown }} */ (error)?.code;
  return typeof code === 'string' && AUTH_CANCELLED_CODES.has(code);
}

/**
 * Runs the production Google popup sign-in helper.
 * @returns {Promise<unknown>} Firebase UserCredential-like result.
 */
async function defaultSignInWithGoogle() {
  const { signInWithGoogle } = await import('@/lib/firebase-auth-helpers');
  return signInWithGoogle();
}

/**
 * Runs the production add-only content favorite helper.
 * @param {{ uid: string, type: FavoriteLoginContinuationContentType, targetId: string }} params
 *   Add favorite params.
 * @returns {Promise<unknown>} Add favorite result.
 */
async function defaultAddContentFavorite(params) {
  const { addContentFavorite } = await import(
    '@/runtime/client/use-cases/content-favorite-use-cases'
  );
  return addContentFavorite(params);
}

/**
 * Runs the add-only favorite continuation after the user confirms Google sign-in.
 * @param {{ contentType: unknown, targetId: unknown }} request - Continuation request.
 * @param {FavoriteLoginContinuationCollaborators} [options] - Runtime collaborators.
 * @returns {Promise<FavoriteLoginContinuationResult>} Normalized continuation result.
 */
export async function runFavoriteLoginContinuation(
  request,
  { signIn = defaultSignInWithGoogle, addFavorite = defaultAddContentFavorite, signal } = {},
) {
  const intent = createFavoriteLoginContinuationIntent(request);
  const createCancelledResult = () => ({
    kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.AUTH_CANCELLED,
    contentType: intent.contentType,
    targetId: intent.targetId,
    uid: null,
  });

  if (signal?.aborted) return createCancelledResult();

  let uid = null;
  try {
    const authResult = await signIn();
    if (signal?.aborted) return createCancelledResult();
    uid = getAuthResultUid(authResult);
  } catch (error) {
    return {
      kind: signal?.aborted || isCancelledAuthError(error)
        ? FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.AUTH_CANCELLED
        : FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.AUTH_FAILED,
      contentType: intent.contentType,
      targetId: intent.targetId,
      uid: null,
    };
  }

  if (!uid) {
    return {
      kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.AUTH_FAILED,
      contentType: intent.contentType,
      targetId: intent.targetId,
      uid: null,
    };
  }

  try {
    await addFavorite({
      uid,
      type: intent.contentType,
      targetId: intent.targetId,
    });
  } catch (error) {
    return {
      kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.FAVORITE_ADD_FAILED,
      contentType: intent.contentType,
      targetId: intent.targetId,
      uid,
      error,
    };
  }

  return {
    kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.FAVORITE_ADDED,
    contentType: intent.contentType,
    targetId: intent.targetId,
    uid,
  };
}
