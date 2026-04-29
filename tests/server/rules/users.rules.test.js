/**
 * @file Firestore Rules infra proof for users and weatherFavorites.
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  authenticatedDb,
  cleanupRulesTestEnvironment,
  clearFirestore,
  createRulesTestEnvironment,
  seedFirestore,
  unauthenticatedDb,
} from './_helpers/rules-test-env.js';

/** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
let testEnv;

/**
 * Seeds a basic user profile document.
 * @param {string} uid - User document ID to seed.
 * @returns {Promise<void>} Resolves after the profile is seeded.
 */
async function seedUser(uid) {
  await seedFirestore(testEnv, async (db) => {
    await db.doc(`users/${uid}`).set({
      name: `User ${uid}`,
      photoURL: `https://example.test/${uid}.png`,
    });
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

describe('users Firestore rules', () => {
  it('allows unauthenticated clients to read public user profiles', async () => {
    await seedUser('u1');
    const db = unauthenticatedDb(testEnv);

    await assertSucceeds(db.doc('users/u1').get());
  });

  it('allows authenticated users to create their own profile', async () => {
    const db = authenticatedDb(testEnv, 'u1');

    await assertSucceeds(db.doc('users/u1').set({ name: 'User One' }));
  });

  it('denies authenticated users creating another user profile', async () => {
    const db = authenticatedDb(testEnv, 'u2');

    await assertFails(db.doc('users/u1').set({ name: 'Imposter' }));
  });

  it('allows profile owners to update non-bio fields', async () => {
    await seedUser('u1');
    const db = authenticatedDb(testEnv, 'u1');

    await assertSucceeds(db.doc('users/u1').update({ name: 'Updated User' }));
  });

  it('denies profile updates from non-owners', async () => {
    await seedUser('u1');
    const db = authenticatedDb(testEnv, 'u2');

    await assertFails(db.doc('users/u1').update({ name: 'Cross User' }));
  });

  it('allows 150-character bio updates and denies 151-character bio updates', async () => {
    await seedUser('u1');
    const db = authenticatedDb(testEnv, 'u1');

    await assertSucceeds(db.doc('users/u1').update({ bio: 'a'.repeat(150) }));
    await assertFails(db.doc('users/u1').update({ bio: 'a'.repeat(151) }));
  });

  it('denies deleting user profiles', async () => {
    await seedUser('u1');
    const db = authenticatedDb(testEnv, 'u1');

    await assertFails(db.doc('users/u1').delete());
  });

  it('allows only the owner to read and write weather favorites', async () => {
    await seedUser('u1');
    await seedFirestore(testEnv, async (db) => {
      await db.doc('users/u1/weatherFavorites/taipei').set({
        locationName: 'Taipei',
      });
    });
    const ownerDb = authenticatedDb(testEnv, 'u1');
    const nonOwnerDb = authenticatedDb(testEnv, 'u2');

    await assertSucceeds(ownerDb.doc('users/u1/weatherFavorites/taipei').get());
    await assertSucceeds(
      ownerDb.doc('users/u1/weatherFavorites/keelung').set({ locationName: 'Keelung' }),
    );
    await assertFails(nonOwnerDb.doc('users/u1/weatherFavorites/taipei').get());
    await assertFails(
      nonOwnerDb.doc('users/u1/weatherFavorites/taichung').set({ locationName: 'Taichung' }),
    );
  });
});
