export const FAVORITE_LOGIN_CONTINUATION_CONTENT_TYPES = Object.freeze({
  EVENT: 'event',
  POST: 'post',
});

export const FAVORITE_LOGIN_CONTINUATION_STATUSES = Object.freeze({
  OPEN: 'open',
  AUTHENTICATING: 'authenticating',
  APPLYING_FAVORITE: 'applyingFavorite',
});

export const FAVORITE_LOGIN_CONTINUATION_COPY = Object.freeze({
  TITLE: '登入後即可收藏',
  EVENT_BODY: '登入後會自動將這個活動加入收藏。',
  POST_BODY: '登入後會自動將這篇文章加入收藏。',
  PRIMARY_LABEL: '使用 Google 登入',
  SECONDARY_LABEL: '稍後再說',
});

const COPY_BODY_BY_CONTENT_TYPE = Object.freeze({
  [FAVORITE_LOGIN_CONTINUATION_CONTENT_TYPES.EVENT]:
    FAVORITE_LOGIN_CONTINUATION_COPY.EVENT_BODY,
  [FAVORITE_LOGIN_CONTINUATION_CONTENT_TYPES.POST]:
    FAVORITE_LOGIN_CONTINUATION_COPY.POST_BODY,
});

/**
 * @typedef {'event' | 'post'} FavoriteLoginContinuationContentType
 * @typedef {'open' | 'authenticating' | 'applyingFavorite'} FavoriteLoginContinuationStatus
 * @typedef {{
 *   contentType: FavoriteLoginContinuationContentType,
 *   targetId: string,
 *   copyKind: FavoriteLoginContinuationContentType,
 *   status: FavoriteLoginContinuationStatus,
 *   createdAtMs: number
 * }} FavoriteLoginContinuationIntent
 * @typedef {{
 *   isOpen: boolean,
 *   contentType: FavoriteLoginContinuationContentType | null,
 *   title: string,
 *   body: string,
 *   primaryLabel: string,
 *   secondaryLabel: string,
 *   isSubmitting: boolean
 * }} FavoriteLoginContinuationDialogState
 */

/**
 * Returns a supported favorite continuation content type.
 * @param {unknown} contentType - Content type candidate.
 * @returns {FavoriteLoginContinuationContentType} Normalized content type.
 */
function normalizeFavoriteContinuationContentType(contentType) {
  if (contentType === FAVORITE_LOGIN_CONTINUATION_CONTENT_TYPES.EVENT) {
    return FAVORITE_LOGIN_CONTINUATION_CONTENT_TYPES.EVENT;
  }

  if (contentType === FAVORITE_LOGIN_CONTINUATION_CONTENT_TYPES.POST) {
    return FAVORITE_LOGIN_CONTINUATION_CONTENT_TYPES.POST;
  }

  throw new Error('Unsupported favorite continuation content type');
}

/**
 * Returns a non-empty favorite continuation target id.
 * @param {unknown} targetId - Target id candidate.
 * @returns {string} Normalized target id.
 */
function normalizeFavoriteContinuationTargetId(targetId) {
  if (typeof targetId !== 'string') {
    throw new Error('Favorite continuation targetId is required');
  }

  const normalizedTargetId = targetId.trim();
  if (!normalizedTargetId) {
    throw new Error('Favorite continuation targetId is required');
  }

  return normalizedTargetId;
}

/**
 * Returns whether a value is a supported continuation status.
 * @param {unknown} status - Status candidate.
 * @returns {status is FavoriteLoginContinuationStatus} Whether the status is supported.
 */
function isFavoriteLoginContinuationStatus(status) {
  return (
    status === FAVORITE_LOGIN_CONTINUATION_STATUSES.OPEN ||
    status === FAVORITE_LOGIN_CONTINUATION_STATUSES.AUTHENTICATING ||
    status === FAVORITE_LOGIN_CONTINUATION_STATUSES.APPLYING_FAVORITE
  );
}

/**
 * Returns exact dialog copy for a supported content type.
 * @param {unknown} contentType - Content type candidate.
 * @returns {{ title: string, body: string, primaryLabel: string, secondaryLabel: string }}
 *   Dialog copy.
 */
export function getFavoriteLoginContinuationCopy(contentType) {
  const normalizedContentType = normalizeFavoriteContinuationContentType(contentType);

  return {
    title: FAVORITE_LOGIN_CONTINUATION_COPY.TITLE,
    body: COPY_BODY_BY_CONTENT_TYPE[normalizedContentType],
    primaryLabel: FAVORITE_LOGIN_CONTINUATION_COPY.PRIMARY_LABEL,
    secondaryLabel: FAVORITE_LOGIN_CONTINUATION_COPY.SECONDARY_LABEL,
  };
}

/**
 * Creates one in-memory favorite login continuation intent.
 * @param {{ contentType: unknown, targetId: unknown }} request - Continuation request.
 * @param {{ nowMs?: () => number }} [options] - Runtime options.
 * @returns {FavoriteLoginContinuationIntent} Normalized intent.
 */
export function createFavoriteLoginContinuationIntent(
  request,
  { nowMs = Date.now } = {},
) {
  const contentType = normalizeFavoriteContinuationContentType(request?.contentType);
  const targetId = normalizeFavoriteContinuationTargetId(request?.targetId);

  return {
    contentType,
    targetId,
    copyKind: contentType,
    status: FAVORITE_LOGIN_CONTINUATION_STATUSES.OPEN,
    createdAtMs: nowMs(),
  };
}

/**
 * Returns a new intent status while preserving intent identity fields.
 * @param {FavoriteLoginContinuationIntent} intent - Existing intent.
 * @param {unknown} status - Next status.
 * @returns {FavoriteLoginContinuationIntent} Intent with next status.
 */
export function setFavoriteLoginContinuationStatus(intent, status) {
  if (!isFavoriteLoginContinuationStatus(status)) {
    throw new Error('Unsupported favorite continuation status');
  }

  return {
    ...intent,
    status,
  };
}

/**
 * Opens a continuation intent only if no intent is active.
 * @param {FavoriteLoginContinuationIntent | null} currentIntent - Current active intent.
 * @param {{ contentType: unknown, targetId: unknown }} request - New open request.
 * @param {{ nowMs?: () => number }} [options] - Runtime options.
 * @returns {FavoriteLoginContinuationIntent} Current or newly created intent.
 */
export function openFavoriteLoginContinuationIntent(currentIntent, request, options = {}) {
  if (currentIntent) return currentIntent;
  return createFavoriteLoginContinuationIntent(request, options);
}

/**
 * Builds dialog render state from an intent.
 * @param {FavoriteLoginContinuationIntent | null} intent - Current intent.
 * @returns {FavoriteLoginContinuationDialogState} Dialog render state.
 */
export function buildFavoriteLoginContinuationDialogState(intent) {
  if (!intent) {
    return {
      isOpen: false,
      contentType: null,
      title: FAVORITE_LOGIN_CONTINUATION_COPY.TITLE,
      body: '',
      primaryLabel: FAVORITE_LOGIN_CONTINUATION_COPY.PRIMARY_LABEL,
      secondaryLabel: FAVORITE_LOGIN_CONTINUATION_COPY.SECONDARY_LABEL,
      isSubmitting: false,
    };
  }

  const copy = getFavoriteLoginContinuationCopy(intent.contentType);

  return {
    isOpen: true,
    contentType: intent.contentType,
    title: copy.title,
    body: copy.body,
    primaryLabel: copy.primaryLabel,
    secondaryLabel: copy.secondaryLabel,
    isSubmitting:
      intent.status === FAVORITE_LOGIN_CONTINUATION_STATUSES.AUTHENTICATING ||
      intent.status === FAVORITE_LOGIN_CONTINUATION_STATUSES.APPLYING_FAVORITE,
  };
}
