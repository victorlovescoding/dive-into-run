/**
 * @file Firestore Rules coverage for notification recipient/read/update gates.
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

const ACTOR_UID = 'actor-uid';
const RECIPIENT_UID = 'recipient-uid';
const UNRELATED_UID = 'unrelated-uid';
const ALLOWED_TYPE = 'event_modified';
const FIXED_TIMESTAMP = firebase.firestore.Timestamp.fromDate(new Date('2026-01-01T00:00:00.000Z'));

/** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
let testEnv;

/**
 * Builds a notification document for create attempts or disabled seed data.
 * @param {Record<string, unknown>} [overrides] - Field overrides for this notification.
 * @returns {Record<string, unknown>} Notification payload.
 */
function notificationData(overrides = {}) {
  return {
    actorUid: ACTOR_UID,
    recipientUid: RECIPIENT_UID,
    type: ALLOWED_TYPE,
    read: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    ...overrides,
  };
}

/**
 * Seeds a notification document while rules are disabled.
 * @param {string} id - Notification document ID.
 * @param {Record<string, unknown>} [overrides] - Field overrides for this notification.
 * @returns {Promise<void>} Resolves after the notification is seeded.
 */
async function seedNotification(id, overrides = {}) {
  await seedFirestore(testEnv, async (db) => {
    await db.doc(`notifications/${id}`).set(
      notificationData({
        createdAt: FIXED_TIMESTAMP,
        ...overrides,
      }),
    );
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

describe('notifications Firestore rules', () => {
  it('allows signed-in actors to create notifications for any non-self recipient', async () => {
    const db = authenticatedDb(testEnv, ACTOR_UID);

    await assertSucceeds(
      db
        .doc('notifications/valid-create')
        .set(notificationData({ recipientUid: 'arbitrary-recipient' })),
    );
  });

  it('denies unauthenticated notification creates', async () => {
    const db = unauthenticatedDb(testEnv);

    await assertFails(db.doc('notifications/unauth-create').set(notificationData()));
  });

  it('denies creating notifications addressed to the actor', async () => {
    const db = authenticatedDb(testEnv, ACTOR_UID);

    await assertFails(
      db.doc('notifications/self-recipient').set(notificationData({ recipientUid: ACTOR_UID })),
    );
  });

  it('denies creating notifications when actorUid does not match auth uid', async () => {
    const db = authenticatedDb(testEnv, ACTOR_UID);

    await assertFails(
      db.doc('notifications/actor-mismatch').set(notificationData({ actorUid: UNRELATED_UID })),
    );
  });

  it('denies creating notifications with a non-allowlisted type', async () => {
    const db = authenticatedDb(testEnv, ACTOR_UID);

    await assertFails(
      db.doc('notifications/invalid-type').set(notificationData({ type: 'unknown_type' })),
    );
  });

  it('denies creating notifications when read is not false', async () => {
    const db = authenticatedDb(testEnv, ACTOR_UID);

    await assertFails(db.doc('notifications/read-true').set(notificationData({ read: true })));
  });

  it('denies creating notifications with a fixed createdAt timestamp', async () => {
    const db = authenticatedDb(testEnv, ACTOR_UID);

    await assertFails(
      db
        .doc('notifications/fixed-created-at')
        .set(notificationData({ createdAt: FIXED_TIMESTAMP })),
    );
  });

  it('allows recipients to read their own notifications', async () => {
    await seedNotification('recipient-read');
    const db = authenticatedDb(testEnv, RECIPIENT_UID);

    await assertSucceeds(db.doc('notifications/recipient-read').get());
  });

  it('denies actor, unrelated, and unauthenticated clients reading notifications', async () => {
    await seedNotification('read-denied');
    const actorDb = authenticatedDb(testEnv, ACTOR_UID);
    const unrelatedDb = authenticatedDb(testEnv, UNRELATED_UID);
    const unauthenticated = unauthenticatedDb(testEnv);

    await assertFails(actorDb.doc('notifications/read-denied').get());
    await assertFails(unrelatedDb.doc('notifications/read-denied').get());
    await assertFails(unauthenticated.doc('notifications/read-denied').get());
  });

  it('allows recipients to update only the read field', async () => {
    await seedNotification('read-update');
    const db = authenticatedDb(testEnv, RECIPIENT_UID);

    await assertSucceeds(db.doc('notifications/read-update').update({ read: true }));
  });

  it('denies recipients mutating recipientUid', async () => {
    await seedNotification('mutate-recipient');
    const db = authenticatedDb(testEnv, RECIPIENT_UID);

    await assertFails(
      db.doc('notifications/mutate-recipient').update({ recipientUid: UNRELATED_UID }),
    );
  });

  it('denies recipients mutating type', async () => {
    await seedNotification('mutate-type');
    const db = authenticatedDb(testEnv, RECIPIENT_UID);

    await assertFails(db.doc('notifications/mutate-type').update({ type: 'event_cancelled' }));
  });

  it('denies recipients mutating actorUid', async () => {
    await seedNotification('mutate-actor');
    const db = authenticatedDb(testEnv, RECIPIENT_UID);

    await assertFails(db.doc('notifications/mutate-actor').update({ actorUid: UNRELATED_UID }));
  });

  it('denies actor and unrelated clients updating notifications', async () => {
    await seedNotification('non-recipient-update');
    const actorDb = authenticatedDb(testEnv, ACTOR_UID);
    const unrelatedDb = authenticatedDb(testEnv, UNRELATED_UID);

    await assertFails(actorDb.doc('notifications/non-recipient-update').update({ read: true }));
    await assertFails(unrelatedDb.doc('notifications/non-recipient-update').update({ read: true }));
  });

  it('denies deleting notifications for all clients', async () => {
    await seedNotification('delete-denied');
    const recipientDb = authenticatedDb(testEnv, RECIPIENT_UID);
    const actorDb = authenticatedDb(testEnv, ACTOR_UID);
    const unauthenticated = unauthenticatedDb(testEnv);

    await assertFails(recipientDb.doc('notifications/delete-denied').delete());
    await assertFails(actorDb.doc('notifications/delete-denied').delete());
    await assertFails(unauthenticated.doc('notifications/delete-denied').delete());
  });
});
