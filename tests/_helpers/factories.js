/**
 * Cross-domain Firestore fixture primitives for tests.
 * Domain defaults belong in domain-specific helpers, not here.
 */

/**
 * @typedef {object} FirestoreDocSnapshotOptions
 * @property {boolean} [exists] - Whether the document exists.
 * @property {string} [path] - Firestore-like document path.
 * @property {object} [ref] - Firestore-like document ref override.
 */

/**
 * @typedef {object} FirestoreDocSnapshot
 * @property {string} id - Document ID.
 * @property {object} ref - Firestore-like document ref.
 * @property {() => boolean} exists - Whether the document exists.
 * @property {() => object | null} data - Document payload getter.
 */

/**
 * Creates a Firestore-like document snapshot.
 * @param {string} id - Document ID.
 * @param {object | null} data - Document payload, or null for a missing document.
 * @param {FirestoreDocSnapshotOptions} [options] - Snapshot options.
 * @returns {FirestoreDocSnapshot} Firestore-like document snapshot.
 */
export function createFirestoreDocSnapshot(id, data, options = {}) {
  return {
    id,
    ref: options.ref ?? { id, path: options.path ?? id },
    exists: () => options.exists ?? data !== null,
    data: () => data,
  };
}

/**
 * @typedef {object} FirestoreQueryDocInput
 * @property {string} id - Document ID.
 * @property {object | null} data - Document payload.
 * @property {string} [path] - Firestore-like document path.
 */

/**
 * @typedef {object} FirestoreDocChangeInput
 * @property {string} type - Change type such as `added`, `modified`, or `removed`.
 * @property {FirestoreDocSnapshot | FirestoreQueryDocInput} doc - Changed document.
 */

/**
 * @typedef {object} FirestoreQuerySnapshotOptions
 * @property {FirestoreDocChangeInput[]} [changes] - Query docChanges entries.
 */

/**
 * @typedef {object} FirestoreQuerySnapshot
 * @property {FirestoreDocSnapshot[]} docs - Query document snapshots.
 * @property {number} size - Query result size.
 * @property {() => Array<{ type: string, doc: FirestoreDocSnapshot }>} docChanges - Changes getter.
 */

/**
 * Normalizes a snapshot or `{ id, data }` pair into a Firestore-like doc snapshot.
 * @param {FirestoreDocSnapshot | FirestoreQueryDocInput} doc - Document input.
 * @returns {FirestoreDocSnapshot} Firestore-like document snapshot.
 */
function toFirestoreDocSnapshot(doc) {
  if ('exists' in doc) {
    return doc;
  }

  return createFirestoreDocSnapshot(doc.id, doc.data, { path: doc.path });
}

/**
 * Creates a Firestore-like query snapshot.
 * @param {Array<FirestoreDocSnapshot | FirestoreQueryDocInput>} docs - Query documents.
 * @param {FirestoreQuerySnapshotOptions} [options] - Snapshot options.
 * @returns {FirestoreQuerySnapshot} Firestore-like query snapshot.
 */
export function createFirestoreQuerySnapshot(docs, options = {}) {
  const snapshots = docs.map(toFirestoreDocSnapshot);
  return {
    docs: snapshots,
    size: snapshots.length,
    docChanges: () =>
      (options.changes ?? []).map((change) => ({
        type: change.type,
        doc: toFirestoreDocSnapshot(change.doc),
      })),
  };
}
