/* eslint @vitest/expect-expect: ["error", { "assertFunctionNames": ["expect", "assertSucceeds", "assertFails"] }] */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-test-event-favorites';
const RULES_PATH = 'firestore.rules';
const ONE_HOUR_MS = 60 * 60 * 1000;

/** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

/**
 * Returns an authenticated Firestore test client.
 * @param {string} uid - Authenticated uid.
 * @returns {import('firebase/firestore').Firestore} Firestore client.
 */
function dbFor(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

/**
 * Seeds Firestore with security rules disabled.
 * @param {(db: import('firebase/firestore').Firestore) => Promise<void>} seedFn - Seed callback.
 * @returns {Promise<void>} Seed completion.
 */
async function seed(seedFn) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await seedFn(context.firestore());
  });
}

/**
 * Builds a Firestore Timestamp relative to test execution time.
 * @param {number} offsetMs - Offset from now in milliseconds.
 * @returns {import('firebase/firestore').Timestamp} Offset timestamp.
 */
function timestampFromNow(offsetMs) {
  return Timestamp.fromMillis(Date.now() + offsetMs);
}

/**
 * Seeds one started event document.
 * @param {string} eventId - Event id.
 * @returns {Promise<void>} Seed completion.
 */
async function seedStartedEvent(eventId) {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, 'events', eventId), {
      hostUid: 'event-host',
      title: 'Started city run',
      time: timestampFromNow(-ONE_HOUR_MS),
      registrationDeadline: timestampFromNow(-2 * ONE_HOUR_MS),
      distanceKm: 5,
      maxParticipants: 20,
      participantsCount: 1,
      remainingSeats: 19,
    });
  });
}

/**
 * Seeds one user event favorite document.
 * @param {string} uid - Favorite owner uid.
 * @param {string} eventId - Event id.
 * @returns {Promise<void>} Seed completion.
 */
async function seedEventFavorite(uid, eventId) {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, 'users', uid, 'favoriteEvents', eventId), {
      targetId: eventId,
      createdAt: timestampFromNow(-30 * 60 * 1000),
    });
  });
}

describe('started event favorite Firestore rules', () => {
  it('allows favorite create after start when existing favorite rules allow it', async () => {
    const eventId = 'started-favorite-create';
    await seedStartedEvent(eventId);

    await assertSucceeds(
      setDoc(doc(dbFor('runner-1'), 'users', 'runner-1', 'favoriteEvents', eventId), {
        targetId: eventId,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('allows favorite delete after start when existing favorite rules allow it', async () => {
    const eventId = 'started-favorite-delete';
    await seedStartedEvent(eventId);
    await seedEventFavorite('runner-1', eventId);

    await assertSucceeds(
      deleteDoc(doc(dbFor('runner-1'), 'users', 'runner-1', 'favoriteEvents', eventId)),
    );
  });
});
