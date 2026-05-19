export const FAVORITE_CONTENT_TYPES = Object.freeze({
  POST: 'post',
  EVENT: 'event',
});

const FAVORITE_CONTENT_CONFIG = Object.freeze({
  [FAVORITE_CONTENT_TYPES.POST]: Object.freeze({
    favoriteCollectionName: 'favoritePosts',
    targetCollectionName: 'posts',
  }),
  [FAVORITE_CONTENT_TYPES.EVENT]: Object.freeze({
    favoriteCollectionName: 'favoriteEvents',
    targetCollectionName: 'events',
  }),
});

/**
 * @typedef {{ targetId?: unknown, createdAt?: unknown }} FavoriteDocumentData
 * @typedef {{ id: string, targetId: string, createdAt: unknown }} NormalizedFavorite
 * @typedef {{ id: string, exists: () => boolean, data: () => object }} DocumentSnapshotLike
 */

/**
 * Returns the config for a supported favorite content type.
 * @param {string} type - Favorite content type.
 * @returns {{ favoriteCollectionName: string, targetCollectionName: string }} Collection config.
 */
function getFavoriteConfig(type) {
  const config = FAVORITE_CONTENT_CONFIG[type];
  if (!config) {
    throw new Error(`Unsupported favorite content type: ${type}`);
  }
  return config;
}

/**
 * Returns a non-empty target ID string without coercing nullish values into paths.
 * @param {unknown} targetId - Target post or event ID candidate.
 * @param {string} [message] - Error message for invalid target IDs.
 * @returns {string} Normalized target ID.
 */
export function normalizeFavoriteTargetId(targetId, message = 'Favorite targetId is required') {
  if (typeof targetId !== 'string') {
    throw new Error(message);
  }

  const normalized = targetId.trim();
  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

/**
 * Returns the owner subcollection name for a favorite content type.
 * @param {string} type - Favorite content type.
 * @returns {string} Owner favorite subcollection name.
 */
export function getFavoriteCollectionName(type) {
  return getFavoriteConfig(type).favoriteCollectionName;
}

/**
 * Returns the target top-level collection name for a favorite content type.
 * @param {string} type - Favorite content type.
 * @returns {string} Target top-level collection name.
 */
export function getTargetCollectionName(type) {
  return getFavoriteConfig(type).targetCollectionName;
}

/**
 * Builds the only allowed Firestore favorite payload shape.
 * @param {string} targetId - Target post or event ID.
 * @param {unknown} createdAtValue - Firestore timestamp sentinel or timestamp.
 * @returns {{ targetId: string, createdAt: unknown }} Favorite payload.
 */
export function buildFavoritePayload(targetId, createdAtValue) {
  return {
    targetId: normalizeFavoriteTargetId(targetId),
    createdAt: createdAtValue,
  };
}

/**
 * Normalizes one favorite document snapshot.
 * @param {{ id: string, data: () => object }} snapshot - Firestore favorite snapshot.
 * @returns {NormalizedFavorite} Normalized favorite.
 */
export function normalizeFavoriteDocument(snapshot) {
  const data = /** @type {FavoriteDocumentData} */ (snapshot.data());
  const targetId = normalizeFavoriteTargetId(data.targetId);

  return {
    id: snapshot.id,
    targetId,
    createdAt: data.createdAt,
  };
}

/**
 * Normalizes favorite document snapshots while preserving query order.
 * @param {{ id: string, data: () => object }[]} snapshots - Firestore favorite snapshots.
 * @returns {NormalizedFavorite[]} Normalized favorites.
 */
export function normalizeFavoriteDocuments(snapshots) {
  return snapshots.map((snapshot) => normalizeFavoriteDocument(snapshot));
}

/**
 * Builds a target ID set from existing favorite snapshots.
 * @param {DocumentSnapshotLike[]} snapshots - Favorite docs.
 * @returns {Set<string>} Existing favorite target IDs.
 */
export function toFavoriteTargetIdSet(snapshots) {
  const ids = new Set();

  snapshots.forEach((snapshot) => {
    if (!snapshot.exists()) return;
    try {
      ids.add(normalizeFavoriteTargetId(snapshot.id));
    } catch {
      // Status hydration is best-effort; invalid doc ids should not break page loads.
    }
  });

  return ids;
}

/**
 * Shapes a favorite row with its latest target document or a missing-target marker.
 * @param {object} params - Favorite target params.
 * @param {string} params.type - Favorite content type.
 * @param {NormalizedFavorite} params.favorite - Favorite doc.
 * @param {DocumentSnapshotLike} params.targetSnapshot - Target snapshot.
 * @returns {{ type: string, favoriteId: string, targetId: string, createdAt: unknown, target: object | null, missing: boolean }} Favorite target item.
 */
export function buildFavoriteTargetItem({ type, favorite, targetSnapshot }) {
  const base = {
    type,
    favoriteId: favorite.id,
    targetId: favorite.targetId,
    createdAt: favorite.createdAt,
  };

  if (!targetSnapshot.exists()) {
    return {
      ...base,
      target: null,
      missing: true,
    };
  }

  return {
    ...base,
    target: {
      ...targetSnapshot.data(),
      id: targetSnapshot.id,
    },
    missing: false,
  };
}
