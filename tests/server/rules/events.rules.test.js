/**
 * @file Firestore Rules coverage for events seat counters and participants.
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
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

/**
 * Seeds an event document with participant counters.
 * @param {string} eventId - Event document ID to seed.
 * @param {object} [overrides] - Event fields to override.
 * @param {string} [overrides.hostUid] - Event host user ID.
 * @param {number} [overrides.maxParticipants] - Maximum participant count.
 * @param {number} [overrides.participantsCount] - Current participant count.
 * @param {number} [overrides.remainingSeats] - Current remaining seat count.
 * @returns {Promise<void>} Resolves after the event is seeded.
 */
async function seedEvent(eventId, overrides = {}) {
  const event = {
    hostUid: 'host-1',
    title: 'Morning Run',
    time: new Date('2030-01-01T00:00:00.000Z'),
    registrationDeadline: new Date('2029-12-31T00:00:00.000Z'),
    locationName: 'Taipei',
    distanceKm: 10,
    maxParticipants: 5,
    participantsCount: 2,
    remainingSeats: 3,
    ...overrides,
  };

  await seedFirestore(testEnv, async (db) => {
    await db.doc(`events/${eventId}`).set(event);
  });
}

/**
 * Seeds an event participant document.
 * @param {string} eventId - Parent event document ID.
 * @param {string} uid - Participant user ID and document ID.
 * @returns {Promise<void>} Resolves after the participant is seeded.
 */
async function seedParticipant(eventId, uid) {
  await seedFirestore(testEnv, async (db) => {
    await db.doc(`events/${eventId}/participants/${uid}`).set({
      uid,
      eventId,
      name: `Runner ${uid}`,
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

describe('events Firestore rules', () => {
  describe('seat consistency updates', () => {
    it('allows non-hosts to update only valid seat counters', async () => {
      await seedEvent('event-1');
      const db = authenticatedDb(testEnv, 'runner-1');

      await assertSucceeds(db.doc('events/event-1').update({
        participantsCount: 3,
        remainingSeats: 2,
      }));
    });

    it('denies non-host seat updates that oversell maxParticipants', async () => {
      await seedEvent('event-1');
      const db = authenticatedDb(testEnv, 'runner-1');

      await assertFails(db.doc('events/event-1').update({
        participantsCount: 6,
        remainingSeats: 0,
      }));
    });

    it('denies non-host seat updates with negative participantsCount', async () => {
      await seedEvent('event-1');
      const db = authenticatedDb(testEnv, 'runner-1');

      await assertFails(db.doc('events/event-1').update({
        participantsCount: -1,
        remainingSeats: 6,
      }));
    });

    it('denies non-host seat updates with negative remainingSeats', async () => {
      await seedEvent('event-1');
      const db = authenticatedDb(testEnv, 'runner-1');

      await assertFails(db.doc('events/event-1').update({
        participantsCount: 6,
        remainingSeats: -1,
      }));
    });

    it('denies non-host seat updates when counters do not sum to maxParticipants', async () => {
      await seedEvent('event-1');
      const db = authenticatedDb(testEnv, 'runner-1');

      await assertFails(db.doc('events/event-1').update({
        participantsCount: 3,
        remainingSeats: 3,
      }));
    });

    it('denies non-host updates to title or unrelated fields', async () => {
      await seedEvent('event-1');
      const db = authenticatedDb(testEnv, 'runner-1');

      await assertFails(db.doc('events/event-1').update({ title: 'Evening Run' }));
      await assertFails(db.doc('events/event-1').update({ locationName: 'Keelung' }));
    });

    it('documents current gap: non-hosts can add a new unrelated field', async () => {
      await seedEvent('event-1');
      const db = authenticatedDb(testEnv, 'runner-1');

      await assertSucceeds(db.doc('events/event-1').update({
        reviewOnlyAddedField: 'allowed-by-changedKeys-gap',
      }));
    });

    it('denies hosts lowering maxParticipants below current participantsCount', async () => {
      await seedEvent('event-1', { participantsCount: 3, remainingSeats: 2 });
      const db = authenticatedDb(testEnv, 'host-1');

      await assertFails(db.doc('events/event-1').update({ maxParticipants: 2 }));
    });

    it('allows hosts to set maxParticipants at or above current participantsCount', async () => {
      await seedEvent('event-1', { participantsCount: 3, remainingSeats: 2 });
      const db = authenticatedDb(testEnv, 'host-1');

      await assertSucceeds(db.doc('events/event-1').update({ maxParticipants: 3 }));
    });
  });

  describe('participants cascade rules', () => {
    it('allows participants to create their own matching participant document', async () => {
      await seedEvent('event-1');
      const db = authenticatedDb(testEnv, 'runner-1');

      await assertSucceeds(db.doc('events/event-1/participants/runner-1').set({
        uid: 'runner-1',
        eventId: 'event-1',
        name: 'Runner One',
        photoURL: 'https://example.test/runner-1.png',
      }));
    });

    it('denies creating participant documents with a forged uid', async () => {
      await seedEvent('event-1');
      const db = authenticatedDb(testEnv, 'runner-1');

      await assertFails(db.doc('events/event-1/participants/runner-2').set({
        uid: 'runner-2',
        eventId: 'event-1',
        name: 'Runner Two',
        photoURL: 'https://example.test/runner-2.png',
      }));
    });

    it('allows participants to delete their own participant document', async () => {
      await seedEvent('event-1');
      await seedParticipant('event-1', 'runner-1');
      const db = authenticatedDb(testEnv, 'runner-1');

      await assertSucceeds(db.doc('events/event-1/participants/runner-1').delete());
    });

    it('allows event hosts to delete any participant under their event', async () => {
      await seedEvent('event-1');
      await seedParticipant('event-1', 'runner-1');
      const db = authenticatedDb(testEnv, 'host-1');

      await assertSucceeds(db.doc('events/event-1/participants/runner-1').delete());
    });

    it('denies unrelated users deleting another participant document', async () => {
      await seedEvent('event-1');
      await seedParticipant('event-1', 'runner-1');
      const db = authenticatedDb(testEnv, 'runner-2');

      await assertFails(db.doc('events/event-1/participants/runner-1').delete());
    });

    it('denies participant document updates', async () => {
      await seedEvent('event-1');
      await seedParticipant('event-1', 'runner-1');
      const db = authenticatedDb(testEnv, 'runner-1');

      await assertFails(db.doc('events/event-1/participants/runner-1').update({
        name: 'Updated Runner',
      }));
    });
  });
});
