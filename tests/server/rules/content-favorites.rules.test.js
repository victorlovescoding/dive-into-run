/**
 * @file Firestore Rules coverage for private post and event favorites.
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  authenticatedDb,
  cleanupRulesTestEnvironment,
  clearFirestore,
  createRulesTestEnvironment,
  seedFirestore,
} from './_helpers/rules-test-env.js';

/** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
let testEnv;

const FAVORITE_COLLECTIONS = [
  { name: 'favoritePosts', targetId: 'post-1', otherTargetId: 'post-2' },
  { name: 'favoriteEvents', targetId: 'event-1', otherTargetId: 'event-2' },
];
const FIXED_TIMESTAMP = firebase.firestore.Timestamp.fromDate(new Date('2026-05-19T00:00:00.000Z'));

/**
 * Builds the valid favorite document payload.
 * @param {string} targetId - Target post or event ID.
 * @returns {{ targetId: string, createdAt: import('firebase/compat/app').default.firestore.FieldValue }} Valid favorite payload.
 */
function favoritePayload(targetId) {
  return {
    targetId,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
}

/**
 * Builds an owner-scoped favorite document path.
 * @param {string} uid - Favorite owner UID.
 * @param {string} collectionName - Favorite subcollection name.
 * @param {string} targetId - Target post or event ID.
 * @returns {string} Firestore document path.
 */
function favoritePath(uid, collectionName, targetId) {
  return `users/${uid}/${collectionName}/${targetId}`;
}

/**
 * Seeds a favorite document while rules are disabled.
 * @param {string} uid - Favorite owner UID.
 * @param {string} collectionName - Favorite subcollection name.
 * @param {string} targetId - Target post or event ID.
 * @returns {Promise<void>} Resolves after seeding completes.
 */
async function seedFavorite(uid, collectionName, targetId) {
  await seedFirestore(testEnv, async (db) => {
    await db.doc(favoritePath(uid, collectionName, targetId)).set(favoritePayload(targetId));
  });
}

beforeAll(async () => {
  testEnv = await createRulesTestEnvironment();
});

beforeEach(async () => {
  await clearFirestore(testEnv);
});

afterAll(async () => {
  await cleanupRulesTestEnvironment(testEnv);
});

describe('content favorites Firestore rules', () => {
  describe.each(FAVORITE_COLLECTIONS)('$name', ({ name, targetId, otherTargetId }) => {
    it('allows owners to read their favorite document', async () => {
      await seedFavorite('owner-uid', name, targetId);
      const db = authenticatedDb(testEnv, 'owner-uid');

      await assertSucceeds(db.doc(favoritePath('owner-uid', name, targetId)).get());
    });

    it('allows owners to create a matching favorite document', async () => {
      const db = authenticatedDb(testEnv, 'owner-uid');

      await assertSucceeds(
        db.doc(favoritePath('owner-uid', name, targetId)).set(favoritePayload(targetId)),
      );
    });

    it('allows owners to delete their favorite document', async () => {
      await seedFavorite('owner-uid', name, targetId);
      const db = authenticatedDb(testEnv, 'owner-uid');

      await assertSucceeds(db.doc(favoritePath('owner-uid', name, targetId)).delete());
    });

    it('denies cross-user reads', async () => {
      await seedFavorite('owner-uid', name, targetId);
      const db = authenticatedDb(testEnv, 'other-uid');

      await assertFails(db.doc(favoritePath('owner-uid', name, targetId)).get());
    });

    it('denies cross-user creates', async () => {
      const db = authenticatedDb(testEnv, 'other-uid');

      await assertFails(
        db.doc(favoritePath('owner-uid', name, targetId)).set(favoritePayload(targetId)),
      );
    });

    it('denies cross-user deletes', async () => {
      await seedFavorite('owner-uid', name, targetId);
      const db = authenticatedDb(testEnv, 'other-uid');

      await assertFails(db.doc(favoritePath('owner-uid', name, targetId)).delete());
    });

    it('denies updates from the owner', async () => {
      await seedFavorite('owner-uid', name, targetId);
      const db = authenticatedDb(testEnv, 'owner-uid');

      await assertFails(
        db.doc(favoritePath('owner-uid', name, targetId)).update({
          createdAt: new Date('2026-05-19T01:00:00.000Z'),
        }),
      );
    });

    it('denies creates with a client-supplied timestamp that is not request.time', async () => {
      const db = authenticatedDb(testEnv, 'owner-uid');

      await assertFails(
        db.doc(favoritePath('owner-uid', name, targetId)).set({
          targetId,
          createdAt: FIXED_TIMESTAMP,
        }),
      );
    });

    it('denies whitespace-only targetId even when it matches the document id', async () => {
      const db = authenticatedDb(testEnv, 'owner-uid');
      const whitespaceTargetId = '   ';

      await assertFails(
        db.doc(favoritePath('owner-uid', name, whitespaceTargetId)).set(
          favoritePayload(whitespaceTargetId),
        ),
      );
    });

    it('denies leading or trailing whitespace targetId even when it matches the document id', async () => {
      const db = authenticatedDb(testEnv, 'owner-uid');
      const leadingWhitespaceTargetId = ` ${targetId}`;
      const trailingWhitespaceTargetId = `${targetId} `;

      await assertFails(
        db.doc(favoritePath('owner-uid', name, leadingWhitespaceTargetId)).set(
          favoritePayload(leadingWhitespaceTargetId),
        ),
      );
      await assertFails(
        db.doc(favoritePath('owner-uid', name, trailingWhitespaceTargetId)).set(
          favoritePayload(trailingWhitespaceTargetId),
        ),
      );
    });

    it('denies favorite documents with extra fields', async () => {
      const db = authenticatedDb(testEnv, 'owner-uid');

      await assertFails(
        db.doc(favoritePath('owner-uid', name, targetId)).set({
          ...favoritePayload(targetId),
          title: 'Snapshot data is not allowed',
        }),
      );
    });

    it('denies favorite documents missing targetId', async () => {
      const db = authenticatedDb(testEnv, 'owner-uid');

      await assertFails(
        db.doc(favoritePath('owner-uid', name, targetId)).set({
          createdAt: new Date('2026-05-19T00:00:00.000Z'),
        }),
      );
    });

    it('denies favorite documents missing createdAt', async () => {
      const db = authenticatedDb(testEnv, 'owner-uid');

      await assertFails(
        db.doc(favoritePath('owner-uid', name, targetId)).set({
          targetId,
        }),
      );
    });

    it('denies favorite documents with non-timestamp createdAt', async () => {
      const db = authenticatedDb(testEnv, 'owner-uid');

      await assertFails(
        db.doc(favoritePath('owner-uid', name, targetId)).set({
          targetId,
          createdAt: '2026-05-19T00:00:00.000Z',
        }),
      );
    });

    it('denies favorite documents whose targetId does not match the document id', async () => {
      const db = authenticatedDb(testEnv, 'owner-uid');

      await assertFails(
        db.doc(favoritePath('owner-uid', name, targetId)).set(favoritePayload(otherTargetId)),
      );
    });
  });
});
