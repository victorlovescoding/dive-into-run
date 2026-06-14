/* eslint @vitest/expect-expect: ["error", { "assertFunctionNames": ["expect", "assertSucceeds", "assertFails"] }] */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-test-event-comments';
const RULES_PATH = 'firestore.rules';
const RETENTION_DAYS = 90;
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
 * Calculates a Firestore Timestamp offset by whole days.
 * @param {import('firebase/firestore').Timestamp} timestamp - Base timestamp.
 * @param {number} days - Number of days to add.
 * @returns {import('firebase/firestore').Timestamp} Offset timestamp.
 */
function addDaysToTimestamp(timestamp, days) {
  return Timestamp.fromMillis(timestamp.toMillis() + days * 24 * 60 * 60 * 1000);
}

/**
 * Builds the soft-delete payload sent by client runtime code.
 * @param {string} actorUid - Acting user uid.
 * @returns {{
 *   deletedAt: import('firebase/firestore').Timestamp,
 *   deletedByUid: string,
 *   deletedPurgeAt: import('firebase/firestore').Timestamp,
 * }} Firestore update payload.
 */
function softDeletePayload(actorUid) {
  const deletedAt = Timestamp.now();
  return {
    deletedAt,
    deletedByUid: actorUid,
    deletedPurgeAt: addDaysToTimestamp(deletedAt, RETENTION_DAYS),
  };
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
 * Seeds one event comment document.
 * @param {string} eventId - Event id.
 * @param {string} commentId - Comment id.
 * @param {string} authorUid - Comment author uid.
 * @returns {Promise<void>} Seed completion.
 */
async function seedEventComment(eventId, commentId, authorUid) {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, 'events', eventId, 'comments', commentId), {
      authorUid,
      authorName: 'Comment Author',
      authorImgURL: '',
      content: 'See you there',
      createdAt: timestampFromNow(-30 * 60 * 1000),
    });
  });
}

describe('started event comment Firestore rules', () => {
  it('allows comment create after start when existing comment rules allow it', async () => {
    const eventId = 'started-comment-create';
    await seedStartedEvent(eventId);

    await assertSucceeds(
      setDoc(doc(dbFor('comment-author'), 'events', eventId, 'comments', 'comment-1'), {
        authorUid: 'comment-author',
        authorName: 'Comment Author',
        authorImgURL: '',
        content: 'Still joining',
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('allows own comment soft-delete after start when existing comment rules allow it', async () => {
    const eventId = 'started-comment-delete-own';
    await seedStartedEvent(eventId);
    await seedEventComment(eventId, 'comment-1', 'comment-author');

    await assertSucceeds(
      updateDoc(
        doc(dbFor('comment-author'), 'events', eventId, 'comments', 'comment-1'),
        softDeletePayload('comment-author'),
      ),
    );
  });
});
