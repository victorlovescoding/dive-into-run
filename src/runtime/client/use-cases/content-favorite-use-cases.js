import { serverTimestamp } from 'firebase/firestore';
import {
  buildFavoritePayload,
  buildFavoriteTargetItem,
  getFavoriteCollectionName,
  getTargetCollectionName,
  normalizeFavoriteTargetId,
  normalizeFavoriteDocuments,
  toFavoriteTargetIdSet,
} from '@/service/content-favorite-service';
import {
  deleteFavoriteDocument,
  fetchFavoriteDocuments,
  fetchFavoriteDocumentsForTargetIds,
  fetchTargetDocuments,
  setFavoriteDocument,
} from '@/repo/client/firebase-content-favorites-repo';

export { FAVORITE_CONTENT_TYPES } from '@/service/content-favorite-service';

const TARGET_ID_REQUIRED_MESSAGE = 'Content favorite targetId is required';

/**
 * Returns a non-empty user ID string.
 * @param {string} uid - Favorite owner UID.
 * @returns {string} Normalized UID.
 */
function requireUid(uid) {
  const normalized = String(uid || '');
  if (!normalized) {
    throw new Error('Content favorite uid is required');
  }
  return normalized;
}

/**
 * Returns a valid target ID before any Firestore path construction.
 * @param {unknown} targetId - Target post or event ID candidate.
 * @returns {string} Normalized target ID.
 */
function requireTargetId(targetId) {
  return normalizeFavoriteTargetId(targetId, TARGET_ID_REQUIRED_MESSAGE);
}

/**
 * Returns normalized target ID strings.
 * @param {unknown[]} targetIds - Target IDs to normalize.
 * @returns {string[]} Normalized unique target IDs.
 */
function normalizeTargetIds(targetIds) {
  if (!Array.isArray(targetIds)) return [];
  return Array.from(new Set(targetIds.map((targetId) => requireTargetId(targetId))));
}

/**
 * Adds a post or event favorite for a signed-in user.
 * @param {object} params - Add favorite params.
 * @param {string} params.uid - Favorite owner UID.
 * @param {string} params.type - Favorite content type.
 * @param {string} params.targetId - Target post or event ID.
 * @returns {Promise<{ targetId: string }>} Added favorite identity.
 */
export async function addContentFavorite({ uid, type, targetId }) {
  const ownerUid = requireUid(uid);
  const normalizedTargetId = requireTargetId(targetId);
  const favoriteCollectionName = getFavoriteCollectionName(type);
  const payload = buildFavoritePayload(normalizedTargetId, serverTimestamp());

  await setFavoriteDocument(ownerUid, favoriteCollectionName, normalizedTargetId, payload);

  return { targetId: normalizedTargetId };
}

/**
 * Removes a post or event favorite for a signed-in user.
 * @param {object} params - Remove favorite params.
 * @param {string} params.uid - Favorite owner UID.
 * @param {string} params.type - Favorite content type.
 * @param {string} params.targetId - Target post or event ID.
 * @returns {Promise<void>} Resolves after removal.
 */
export async function removeContentFavorite({ uid, type, targetId }) {
  const ownerUid = requireUid(uid);
  const normalizedTargetId = requireTargetId(targetId);
  const favoriteCollectionName = getFavoriteCollectionName(type);
  await deleteFavoriteDocument(ownerUid, favoriteCollectionName, normalizedTargetId);
}

/**
 * Lists favorite documents sorted newest first.
 * @param {object} params - List favorite params.
 * @param {string} params.uid - Favorite owner UID.
 * @param {string} params.type - Favorite content type.
 * @returns {Promise<{ id: string, targetId: string, createdAt: unknown }[]>} Favorite docs.
 */
export async function listContentFavorites({ uid, type }) {
  const ownerUid = requireUid(uid);
  const favoriteCollectionName = getFavoriteCollectionName(type);
  const snapshots = await fetchFavoriteDocuments(ownerUid, favoriteCollectionName);
  return normalizeFavoriteDocuments(snapshots);
}

/**
 * Returns the target IDs that are already favorited by the user.
 * @param {object} params - Batch favorite status params.
 * @param {string} params.uid - Favorite owner UID.
 * @param {string} params.type - Favorite content type.
 * @param {string[]} params.targetIds - Target IDs to check.
 * @returns {Promise<Set<string>>} Favorited target IDs.
 */
export async function getFavoritedTargetIds({ uid, type, targetIds }) {
  if (!uid) return new Set();

  const ids = normalizeTargetIds(targetIds);
  if (ids.length === 0) return new Set();

  const favoriteCollectionName = getFavoriteCollectionName(type);
  const snapshots = await fetchFavoriteDocumentsForTargetIds(
    String(uid),
    favoriteCollectionName,
    ids,
  );

  return toFavoriteTargetIdSet(snapshots);
}

/**
 * Loads favorites and resolves their latest target documents.
 * @param {object} params - Favorite page load params.
 * @param {string} params.uid - Favorite owner UID.
 * @param {string} params.type - Favorite content type.
 * @returns {Promise<{ type: string, favoriteId: string, targetId: string, createdAt: unknown, target: object | null, missing: boolean }[]>} Favorite rows.
 */
export async function loadContentFavoritesWithTargets({ uid, type }) {
  if (!uid) return [];

  const favorites = await listContentFavorites({ uid: String(uid), type });
  if (favorites.length === 0) return [];

  const targetCollectionName = getTargetCollectionName(type);
  const targetSnapshots = await fetchTargetDocuments(
    targetCollectionName,
    favorites.map((favorite) => favorite.targetId),
  );

  return favorites.map((favorite, index) =>
    buildFavoriteTargetItem({
      type,
      favorite,
      targetSnapshot: targetSnapshots[index],
    }),
  );
}
