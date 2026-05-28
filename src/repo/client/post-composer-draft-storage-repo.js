const CREATE_DRAFT_KEY_PREFIX = 'post-composer:draft:create';
const EDIT_DRAFT_KEY_PREFIX = 'post-composer:draft:edit';

export const POST_COMPOSER_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * @typedef {{ title: string, content: string, updatedAt: string }} PostComposerDraft
 */

/**
 * @param {unknown} value - Candidate draft payload.
 * @returns {value is PostComposerDraft} True when the payload has valid string fields.
 */
function isPostComposerDraft(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const draft = /** @type {Record<string, unknown>} */ (value);

  return (
    typeof draft.title === 'string' &&
    typeof draft.content === 'string' &&
    typeof draft.updatedAt === 'string'
  );
}

/**
 * @param {string} updatedAt - ISO draft update timestamp.
 * @param {Date} now - Current time used for age comparison.
 * @returns {boolean} True when the timestamp is invalid or older than the max age.
 */
function isExpiredDraft(updatedAt, now) {
  const updatedAtMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedAtMs)) return true;

  return now.getTime() - updatedAtMs > POST_COMPOSER_DRAFT_MAX_AGE_MS;
}

/**
 * @param {Pick<Storage, 'removeItem'>} storage - Storage object to clean up.
 * @param {string} key - Draft storage key to remove.
 * @returns {void}
 */
function removeStorageItem(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    // Treat storage cleanup failures as unavailable storage.
  }
}

/**
 * @returns {Storage | null} Browser localStorage, or null when access is unavailable.
 */
function getDefaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/**
 * @param {{ uid?: string | null, postId?: string | null }} params - Draft target identity.
 * @returns {string | null} Scoped localStorage key, or null when uid is missing.
 */
export function getPostComposerDraftKey({ uid, postId }) {
  if (!uid) return null;

  if (postId === null || postId === undefined) {
    return `${CREATE_DRAFT_KEY_PREFIX}:${uid}`;
  }

  return `${EDIT_DRAFT_KEY_PREFIX}:${uid}:${postId}`;
}

/**
 * @param {{
 *   uid?: string | null,
 *   postId?: string | null,
 *   title: string,
 *   content: string,
 *   now?: Date,
 *   storage?: Pick<Storage, 'setItem'>,
 * }} params - Draft target, payload, timestamp, and storage override.
 * @returns {void}
 */
export function savePostComposerDraft({
  uid,
  postId,
  title,
  content,
  now = new Date(),
  storage,
}) {
  const key = getPostComposerDraftKey({ uid, postId });
  if (!key) return;

  const resolvedStorage = storage ?? getDefaultStorage();
  if (!resolvedStorage) return;

  try {
    resolvedStorage.setItem(
      key,
      JSON.stringify({
        title,
        content,
        updatedAt: now.toISOString(),
      }),
    );
  } catch {
    // localStorage can be unavailable in private browsing or blocked contexts.
  }
}

/**
 * @param {{
 *   uid?: string | null,
 *   postId?: string | null,
 *   now?: Date,
 *   storage?: Pick<Storage, 'getItem' | 'removeItem'>,
 * }} params - Draft target, current time, and storage override.
 * @returns {PostComposerDraft | null} Valid unexpired draft payload, or null.
 */
export function loadPostComposerDraft({
  uid,
  postId,
  now = new Date(),
  storage,
}) {
  const key = getPostComposerDraftKey({ uid, postId });
  if (!key) return null;

  const resolvedStorage = storage ?? getDefaultStorage();
  if (!resolvedStorage) return null;

  let rawDraft;
  try {
    rawDraft = resolvedStorage.getItem(key);
  } catch {
    return null;
  }

  if (!rawDraft) return null;

  let parsedDraft;
  try {
    parsedDraft = JSON.parse(rawDraft);
  } catch {
    removeStorageItem(resolvedStorage, key);
    return null;
  }

  if (!isPostComposerDraft(parsedDraft) || isExpiredDraft(parsedDraft.updatedAt, now)) {
    removeStorageItem(resolvedStorage, key);
    return null;
  }

  return {
    title: parsedDraft.title,
    content: parsedDraft.content,
    updatedAt: parsedDraft.updatedAt,
  };
}

/**
 * @param {{
 *   uid?: string | null,
 *   postId?: string | null,
 *   storage?: Pick<Storage, 'removeItem'>,
 * }} params - Draft target and storage override.
 * @returns {void}
 */
export function removePostComposerDraft({ uid, postId, storage }) {
  const key = getPostComposerDraftKey({ uid, postId });
  if (!key) return;

  const resolvedStorage = storage ?? getDefaultStorage();
  if (!resolvedStorage) return;

  removeStorageItem(resolvedStorage, key);
}
