/**
 * @file Firestore Rules proof for Strava server-owned collections.
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
 * Seeds a Strava token document with security rules disabled.
 * @param {string} uid - Owner user ID and token document ID.
 * @returns {Promise<void>} Resolves after the token is seeded.
 */
async function seedStravaToken(uid) {
  await seedFirestore(testEnv, async (db) => {
    await db.doc(`stravaTokens/${uid}`).set({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });
}

/**
 * Seeds a Strava connection document with security rules disabled.
 * @param {string} uid - Owner user ID and connection document ID.
 * @returns {Promise<void>} Resolves after the connection is seeded.
 */
async function seedStravaConnection(uid) {
  await seedFirestore(testEnv, async (db) => {
    await db.doc(`stravaConnections/${uid}`).set({
      athleteId: 'athlete-1',
      connectedAt: 1,
    });
  });
}

/**
 * Seeds a Strava activity document with security rules disabled.
 * @param {string} activityId - Activity document ID.
 * @param {string} uid - Owner user ID stored on the activity resource.
 * @returns {Promise<void>} Resolves after the activity is seeded.
 */
async function seedStravaActivity(activityId, uid) {
  await seedFirestore(testEnv, async (db) => {
    await db.doc(`stravaActivities/${activityId}`).set({
      uid,
      activityId,
      name: 'Morning Run',
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

describe('stravaTokens Firestore rules', () => {
  it('denies token reads from the owner client', async () => {
    await seedStravaToken('u1');
    const db = authenticatedDb(testEnv, 'u1');

    await assertFails(db.doc('stravaTokens/u1').get());
  });

  it('denies token reads from another authenticated client', async () => {
    await seedStravaToken('u1');
    const db = authenticatedDb(testEnv, 'u2');

    await assertFails(db.doc('stravaTokens/u1').get());
  });

  it('denies token reads from unauthenticated clients', async () => {
    await seedStravaToken('u1');
    const db = unauthenticatedDb(testEnv);

    await assertFails(db.doc('stravaTokens/u1').get());
  });

  it('denies all token writes from clients', async () => {
    await seedStravaToken('u1');
    const db = authenticatedDb(testEnv, 'u1');

    await assertFails(db.doc('stravaTokens/u2').set({ accessToken: 'new-token' }));
    await assertFails(db.doc('stravaTokens/u1').update({ accessToken: 'rotated-token' }));
    await assertFails(db.doc('stravaTokens/u1').delete());
  });
});

describe('stravaConnections Firestore rules', () => {
  it('allows connection reads from the owner client', async () => {
    await seedStravaConnection('u1');
    const db = authenticatedDb(testEnv, 'u1');

    await assertSucceeds(db.doc('stravaConnections/u1').get());
  });

  it('denies connection reads from another authenticated client', async () => {
    await seedStravaConnection('u1');
    const db = authenticatedDb(testEnv, 'u2');

    await assertFails(db.doc('stravaConnections/u1').get());
  });

  it('denies connection reads from unauthenticated clients', async () => {
    await seedStravaConnection('u1');
    const db = unauthenticatedDb(testEnv);

    await assertFails(db.doc('stravaConnections/u1').get());
  });

  it('denies all connection writes from clients', async () => {
    await seedStravaConnection('u1');
    const db = authenticatedDb(testEnv, 'u1');

    await assertFails(db.doc('stravaConnections/u2').set({ athleteId: 'athlete-2' }));
    await assertFails(db.doc('stravaConnections/u1').update({ athleteId: 'athlete-3' }));
    await assertFails(db.doc('stravaConnections/u1').delete());
  });
});

describe('stravaActivities Firestore rules', () => {
  it('allows activity reads from the owner in resource data', async () => {
    await seedStravaActivity('activity-1', 'u1');
    const db = authenticatedDb(testEnv, 'u1');

    await assertSucceeds(db.doc('stravaActivities/activity-1').get());
  });

  it('denies activity reads from another authenticated client', async () => {
    await seedStravaActivity('activity-1', 'u1');
    const db = authenticatedDb(testEnv, 'u2');

    await assertFails(db.doc('stravaActivities/activity-1').get());
  });

  it('denies activity reads from unauthenticated clients', async () => {
    await seedStravaActivity('activity-1', 'u1');
    const db = unauthenticatedDb(testEnv);

    await assertFails(db.doc('stravaActivities/activity-1').get());
  });

  it('denies all activity writes from clients', async () => {
    await seedStravaActivity('activity-1', 'u1');
    const db = authenticatedDb(testEnv, 'u1');

    await assertFails(db.doc('stravaActivities/activity-2').set({ uid: 'u1' }));
    await assertFails(db.doc('stravaActivities/activity-1').update({ name: 'Evening Run' }));
    await assertFails(db.doc('stravaActivities/activity-1').delete());
  });
});
