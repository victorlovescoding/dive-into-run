import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Reads the checked-in Firestore index manifest as structured JSON.
 * @returns {Record<string, unknown>} Parsed Firestore indexes config.
 */
function readFirestoreIndexes() {
  const indexConfigPath = resolve(process.cwd(), 'firestore.indexes.json');
  return JSON.parse(readFileSync(indexConfigPath, 'utf8'));
}

describe('firestore.indexes.json', () => {
  it('defines the comments authorUid collection-group single-field index', () => {
    const firestoreIndexes = readFirestoreIndexes();

    expect(firestoreIndexes.fieldOverrides).toContainEqual({
      collectionGroup: 'comments',
      fieldPath: 'authorUid',
      indexes: [{ order: 'ASCENDING', queryScope: 'COLLECTION_GROUP' }],
    });
  });
});
