/* eslint @vitest/expect-expect: ["error", { "assertFunctionNames": ["expect", "assert", "assertSucceeds", "assertFails"] }] */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-test';
const RULES_PATH = 'firestore.rules';
const RETENTION_DAYS = 90;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

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
 * Calculates a Firestore Timestamp offset by whole days.
 * @param {import('firebase/firestore').Timestamp} timestamp - Base timestamp.
 * @param {number} days - Number of days to add.
 * @returns {import('firebase/firestore').Timestamp} Offset timestamp.
 */
function addDaysToTimestamp(timestamp, days) {
  return Timestamp.fromMillis(timestamp.toMillis() + days * 24 * 60 * 60 * 1000);
}

/**
 * Builds a stale but exact retention payload.
 * @returns {import('firebase/firestore').Timestamp} Backdated delete timestamp.
 */
function staleDeletedAt() {
  return Timestamp.fromMillis(Date.now() - 10 * 60 * 1000);
}

/**
 * Builds the soft-delete payload sent by client runtime code.
 * @param {string} actorUid - Acting user uid.
 * @param {Partial<{
 *   deletedAt: import('firebase/firestore').Timestamp | string,
 *   deletedByUid: string,
 *   deletedPurgeAt: import('firebase/firestore').Timestamp | string,
 * }>} [overrides] - Field overrides.
 * @returns {{
 *   deletedAt: import('firebase/firestore').Timestamp | string,
 *   deletedByUid: string,
 *   deletedPurgeAt: import('firebase/firestore').Timestamp | string,
 * }} Firestore update payload.
 */
function softDeletePayload(actorUid, overrides = {}) {
  const deletedAt = overrides.deletedAt ?? Timestamp.now();
  const deletedPurgeAt = overrides.deletedPurgeAt
    ?? (deletedAt instanceof Timestamp
      ? addDaysToTimestamp(deletedAt, RETENTION_DAYS)
      : addDaysToTimestamp(Timestamp.now(), RETENTION_DAYS));

  return {
    deletedAt,
    deletedByUid: overrides.deletedByUid ?? actorUid,
    deletedPurgeAt,
  };
}

/**
 * Seeds an event tree used by rules tests.
 * @param {object} options - Seed options.
 * @param {string} options.eventId - Event id.
 * @param {string} options.commentId - Comment id.
 * @param {string} options.hostUid - Event host uid.
 * @param {string} options.participantUid - Participant uid.
 * @param {string} options.commentAuthorUid - Event comment author uid.
 * @param {boolean} [options.deletedEvent] - Whether the parent event is soft-deleted.
 * @returns {Promise<void>} Seed completion.
 */
async function seedEventTree({
  eventId,
  commentId,
  hostUid,
  participantUid,
  commentAuthorUid,
  deletedEvent = false,
}) {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, 'events', eventId), {
      hostUid,
      title: 'City run',
      time: Timestamp.fromDate(new Date('2026-05-28T10:00:00.000Z')),
      registrationDeadline: Timestamp.fromDate(new Date('2026-05-27T10:00:00.000Z')),
      distanceKm: 5,
      maxParticipants: 20,
      participantsCount: 1,
      remainingSeats: 19,
      ...(deletedEvent ? softDeletePayload(hostUid, {
        deletedAt: Timestamp.fromDate(new Date('2026-05-28T00:00:00.000Z')),
      }) : {}),
    });
    await setDoc(doc(adminDb, 'events', eventId, 'participants', participantUid), {
      uid: participantUid,
      eventId,
      name: 'Runner',
      photoURL: '',
    });
    await setDoc(doc(adminDb, 'events', eventId, 'comments', commentId), {
      authorUid: commentAuthorUid,
      authorName: 'Event Commenter',
      authorImgURL: '',
      content: 'See you there',
      createdAt: Timestamp.fromDate(new Date('2026-05-28T02:00:00.000Z')),
    });
    await setDoc(doc(adminDb, 'events', eventId, 'comments', commentId, 'history', 'history-1'), {
      content: 'Before edit',
      editedAt: Timestamp.fromDate(new Date('2026-05-28T02:30:00.000Z')),
    });
  });
}

describe('event soft-delete Firestore rules', () => {
  it('denies client hard deletes for events and event comments', async () => {
    await seedEventTree({
      eventId: 'event-1',
      commentId: 'comment-1',
      hostUid: 'event-host',
      participantUid: 'runner-1',
      commentAuthorUid: 'comment-author',
    });

    await assertFails(deleteDoc(doc(dbFor('event-host'), 'events', 'event-1')));
    await assertFails(
      deleteDoc(doc(dbFor('comment-author'), 'events', 'event-1', 'comments', 'comment-1')),
    );
  });

  it('allows exact 90-day authorized event and event-comment soft-delete updates', async () => {
    await seedEventTree({
      eventId: 'event-1',
      commentId: 'comment-1',
      hostUid: 'event-host',
      participantUid: 'runner-1',
      commentAuthorUid: 'comment-author',
    });

    await assertSucceeds(
      updateDoc(
        doc(dbFor('comment-author'), 'events', 'event-1', 'comments', 'comment-1'),
        softDeletePayload('comment-author'),
      ),
    );
    await assertSucceeds(
      updateDoc(doc(dbFor('event-host'), 'events', 'event-1'), softDeletePayload('event-host')),
    );
  });

  it('denies event soft-delete updates with an early purge window', async () => {
    await seedEventTree({
      eventId: 'event-1',
      commentId: 'comment-1',
      hostUid: 'event-host',
      participantUid: 'runner-1',
      commentAuthorUid: 'comment-author',
    });

    const deletedAt = Timestamp.now();

    await assertFails(
      updateDoc(
        doc(dbFor('event-host'), 'events', 'event-1'),
        softDeletePayload('event-host', {
          deletedAt,
          deletedPurgeAt: Timestamp.fromMillis(deletedAt.toMillis() + RETENTION_MS - 1),
        }),
      ),
    );
  });

  it('denies event comment soft-delete updates with an early purge window', async () => {
    await seedEventTree({
      eventId: 'event-1',
      commentId: 'comment-1',
      hostUid: 'event-host',
      participantUid: 'runner-1',
      commentAuthorUid: 'comment-author',
    });

    const deletedAt = Timestamp.now();

    await assertFails(
      updateDoc(
        doc(dbFor('comment-author'), 'events', 'event-1', 'comments', 'comment-1'),
        softDeletePayload('comment-author', {
          deletedAt,
          deletedPurgeAt: addDaysToTimestamp(deletedAt, 1),
        }),
      ),
    );
  });

  it('denies backdated event soft-delete updates with an exact purge window', async () => {
    await seedEventTree({
      eventId: 'event-1',
      commentId: 'comment-1',
      hostUid: 'event-host',
      participantUid: 'runner-1',
      commentAuthorUid: 'comment-author',
    });

    const deletedAt = staleDeletedAt();

    await assertFails(
      updateDoc(
        doc(dbFor('event-host'), 'events', 'event-1'),
        softDeletePayload('event-host', { deletedAt }),
      ),
    );
  });

  it('denies backdated event comment soft-delete updates with an exact purge window', async () => {
    await seedEventTree({
      eventId: 'event-1',
      commentId: 'comment-1',
      hostUid: 'event-host',
      participantUid: 'runner-1',
      commentAuthorUid: 'comment-author',
    });

    const deletedAt = staleDeletedAt();

    await assertFails(
      updateDoc(
        doc(dbFor('comment-author'), 'events', 'event-1', 'comments', 'comment-1'),
        softDeletePayload('comment-author', { deletedAt }),
      ),
    );
  });

  it('allows event hosts to soft-delete comments under active events', async () => {
    await seedEventTree({
      eventId: 'event-1',
      commentId: 'comment-1',
      hostUid: 'event-host',
      participantUid: 'runner-1',
      commentAuthorUid: 'comment-author',
    });

    await assertSucceeds(
      updateDoc(
        doc(dbFor('event-host'), 'events', 'event-1', 'comments', 'comment-1'),
        softDeletePayload('event-host'),
      ),
    );
  });

  it('denies forged event soft-delete updates', async () => {
    await seedEventTree({
      eventId: 'event-1',
      commentId: 'comment-1',
      hostUid: 'event-host',
      participantUid: 'runner-1',
      commentAuthorUid: 'comment-author',
    });

    await assertFails(
      updateDoc(doc(dbFor('intruder'), 'events', 'event-1'), softDeletePayload('intruder')),
    );
    await assertFails(
      updateDoc(
        doc(dbFor('event-host'), 'events', 'event-1'),
        softDeletePayload('event-host', { deletedByUid: 'intruder' }),
      ),
    );
    await assertFails(
      updateDoc(doc(dbFor('event-host'), 'events', 'event-1'), {
        deletedAt: serverTimestamp(),
        deletedByUid: 'event-host',
      }),
    );
    await assertFails(
      updateDoc(
        doc(dbFor('event-host'), 'events', 'event-1'),
        softDeletePayload('event-host', { deletedAt: 'not-a-timestamp' }),
      ),
    );
    await assertFails(
      updateDoc(doc(dbFor('event-host'), 'events', 'event-1'), {
        ...softDeletePayload('event-host'),
        title: 'Changed while deleting',
      }),
    );
  });

  it('denies forged event comment soft-delete updates', async () => {
    await seedEventTree({
      eventId: 'event-1',
      commentId: 'comment-1',
      hostUid: 'event-host',
      participantUid: 'runner-1',
      commentAuthorUid: 'comment-author',
    });

    await assertFails(
      updateDoc(
        doc(dbFor('intruder'), 'events', 'event-1', 'comments', 'comment-1'),
        softDeletePayload('intruder'),
      ),
    );
    await assertFails(
      updateDoc(doc(dbFor('comment-author'), 'events', 'event-1', 'comments', 'comment-1'), {
        deletedAt: serverTimestamp(),
        deletedByUid: 'comment-author',
      }),
    );
    await assertFails(
      updateDoc(
        doc(dbFor('comment-author'), 'events', 'event-1', 'comments', 'comment-1'),
        softDeletePayload('comment-author', { deletedPurgeAt: 'not-a-timestamp' }),
      ),
    );
    await assertFails(
      updateDoc(doc(dbFor('comment-author'), 'events', 'event-1', 'comments', 'comment-1'), {
        ...softDeletePayload('comment-author'),
        content: 'Changed while deleting',
      }),
    );
  });

  it('denies child writes under a soft-deleted event', async () => {
    await seedEventTree({
      eventId: 'deleted-event',
      commentId: 'comment-1',
      hostUid: 'event-host',
      participantUid: 'runner-1',
      commentAuthorUid: 'comment-author',
      deletedEvent: true,
    });

    await assertFails(
      setDoc(doc(dbFor('runner-2'), 'events', 'deleted-event', 'participants', 'runner-2'), {
        uid: 'runner-2',
        eventId: 'deleted-event',
        name: 'Late runner',
        photoURL: '',
      }),
    );
    await assertFails(
      deleteDoc(doc(dbFor('runner-1'), 'events', 'deleted-event', 'participants', 'runner-1')),
    );
    await assertFails(
      setDoc(doc(dbFor('comment-author'), 'events', 'deleted-event', 'comments', 'comment-2'), {
        authorUid: 'comment-author',
        authorName: 'Event Commenter',
        authorImgURL: '',
        content: 'Blocked',
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(
        doc(dbFor('comment-author'), 'events', 'deleted-event', 'comments', 'comment-1'),
        softDeletePayload('comment-author'),
      ),
    );
    await assertFails(
      setDoc(
        doc(dbFor('comment-author'), 'events', 'deleted-event', 'comments', 'comment-1', 'history', 'history-2'),
        {
          content: 'Blocked edit',
          editedAt: serverTimestamp(),
        },
      ),
    );
    await assertFails(
      setDoc(doc(dbFor('runner-1'), 'events', 'deleted-event', 'likes', 'runner-1'), {
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(
      deleteDoc(doc(dbFor('runner-1'), 'events', 'deleted-event', 'likes', 'runner-1')),
    );
    await assertFails(
      setDoc(
        doc(dbFor('runner-1'), 'events', 'deleted-event', 'comments', 'comment-1', 'likes', 'runner-1'),
        {
          createdAt: serverTimestamp(),
        },
      ),
    );
  });

  it('preserves existing allowed writes under active events', async () => {
    await seedEventTree({
      eventId: 'event-1',
      commentId: 'comment-1',
      hostUid: 'event-host',
      participantUid: 'runner-1',
      commentAuthorUid: 'comment-author',
    });

    await assertSucceeds(
      setDoc(doc(dbFor('runner-2'), 'events', 'event-1', 'participants', 'runner-2'), {
        uid: 'runner-2',
        eventId: 'event-1',
        name: 'Late runner',
        photoURL: '',
      }),
    );
    await assertSucceeds(
      setDoc(doc(dbFor('comment-author'), 'events', 'event-1', 'comments', 'comment-2'), {
        authorUid: 'comment-author',
        authorName: 'Event Commenter',
        authorImgURL: '',
        content: 'Allowed',
        createdAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(dbFor('comment-author'), 'events', 'event-1', 'comments', 'comment-1'), {
        content: 'Updated',
      }),
    );
  });

  it('preserves post like writes outside soft-deleted event trees', async () => {
    await seed(async (adminDb) => {
      await setDoc(doc(adminDb, 'posts', 'post-1'), {
        authorUid: 'post-author',
        title: 'Morning run',
        content: 'Easy miles',
        commentsCount: 0,
        likesCount: 0,
      });
    });

    await assertSucceeds(
      setDoc(doc(dbFor('runner-1'), 'posts', 'post-1', 'likes', 'runner-1'), {
        createdAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(deleteDoc(doc(dbFor('runner-1'), 'posts', 'post-1', 'likes', 'runner-1')));
  });
});
