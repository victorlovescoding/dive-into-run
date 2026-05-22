/**
 * @file Firestore Rules infra proof for users and weatherFavorites.
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
      followersCount: 0,
    });
  });
}

/**
 * Builds a mirrored follow document payload for rules tests.
 * @param {string} followerUid - User who follows.
 * @param {string} targetUid - User being followed.
 * @returns {Record<string, unknown>} Follow document payload.
 */
function followPayload(followerUid, targetUid) {
  return {
    followerUid,
    followerName: `User ${followerUid}`,
    followerPhotoURL: `https://example.test/${followerUid}.png`,
    targetUid,
    targetName: `User ${targetUid}`,
    targetPhotoURL: `https://example.test/${targetUid}.png`,
    status: 'following',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
}

/**
 * Seeds a complete follow relationship while rules are disabled.
 * @param {string} followerUid - User who follows.
 * @param {string} targetUid - User being followed.
 * @returns {Promise<void>} Resolves after seed writes complete.
 */
async function seedFollowRelationship(followerUid, targetUid) {
  await seedFirestore(testEnv, async (db) => {
    const payload = {
      ...followPayload(followerUid, targetUid),
      createdAt: firebase.firestore.Timestamp.fromDate(new Date('2026-01-01T00:00:00.000Z')),
    };

    await db.doc(`users/${followerUid}/following/${targetUid}`).set(payload);
    await db.doc(`users/${targetUid}/followers/${followerUid}`).set(payload);
    await db.doc(`users/${targetUid}`).update({ followersCount: 1 });
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

  it('denies user profile creates with client-maintained follow counts', async () => {
    const db = authenticatedDb(testEnv, 'viewer');

    await assertFails(
      db.doc('users/viewer').set({
        name: 'Viewer',
        followingCount: 999,
        followersCount: 999,
      }),
    );
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

  it('allows public reads of follower and following lists', async () => {
    await seedUser('viewer');
    await seedUser('target');
    await seedFollowRelationship('viewer', 'target');
    const db = unauthenticatedDb(testEnv);

    await assertSucceeds(db.doc('users/viewer/following/target').get());
    await assertSucceeds(db.doc('users/target/followers/viewer').get());
    await assertSucceeds(db.collection('users/viewer/following').get());
    await assertSucceeds(db.collection('users/target/followers').get());
  });

  it('denies unauthenticated follow writes', async () => {
    await seedUser('viewer');
    await seedUser('target');
    const db = unauthenticatedDb(testEnv);

    await assertFails(
      db.doc('users/viewer/following/target').set(followPayload('viewer', 'target')),
    );
    await assertFails(
      db.doc('users/target/followers/viewer').set(followPayload('viewer', 'target')),
    );
  });

  it('denies self-follow relationship writes', async () => {
    await seedUser('viewer');
    const db = authenticatedDb(testEnv, 'viewer');

    await assertFails(db.doc('users/viewer/following/viewer').set(followPayload('viewer', 'viewer')));
    await assertFails(db.doc('users/viewer/followers/viewer').set(followPayload('viewer', 'viewer')));
  });

  it('requires mirrored documents and count increments when following', async () => {
    await seedUser('viewer');
    await seedUser('target');
    const db = authenticatedDb(testEnv, 'viewer');

    await assertFails(
      db.doc('users/viewer/following/target').set(followPayload('viewer', 'target')),
    );

    const batch = db.batch();
    batch.set(db.doc('users/viewer/following/target'), followPayload('viewer', 'target'));
    batch.set(db.doc('users/target/followers/viewer'), followPayload('viewer', 'target'));
    batch.update(db.doc('users/target'), { followersCount: 1 });

    await assertSucceeds(batch.commit());
  });

  it('requires mirrored deletes and count decrements when unfollowing', async () => {
    await seedUser('viewer');
    await seedUser('target');
    await seedFollowRelationship('viewer', 'target');
    const db = authenticatedDb(testEnv, 'viewer');

    await assertFails(db.doc('users/viewer/following/target').delete());

    const batch = db.batch();
    batch.delete(db.doc('users/viewer/following/target'));
    batch.delete(db.doc('users/target/followers/viewer'));
    batch.update(db.doc('users/target'), { followersCount: 0 });

    await assertSucceeds(batch.commit());
  });

  it('denies follow count updates outside the bounded count fields', async () => {
    await seedUser('viewer');
    await seedUser('target');
    const db = authenticatedDb(testEnv, 'viewer');

    await assertFails(db.doc('users/target').update({ followersCount: 5 }));
    await assertFails(db.doc('users/target').update({ followersCount: 1, name: 'Mutated' }));
    await assertFails(db.doc('users/viewer').update({ followingCount: 1 }));
    await assertFails(db.doc('users/viewer').update({ followingCount: 5 }));
  });
});
