/* eslint @vitest/expect-expect: ["error", { "assertFunctionNames": ["expect", "assert", "assertSucceeds", "assertFails"] }] */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-test';
const RULES_PATH = 'firestore.rules';
const RETENTION_DAYS = 90;
const ONE_HOUR_MS = 60 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const START_TIMING_CASES = [
  ['before start', ONE_HOUR_MS],
  ['at start', 0],
  ['after start', -ONE_HOUR_MS],
];

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
 * Returns an unauthenticated Firestore test client.
 * @returns {import('firebase/firestore').Firestore} Firestore client.
 */
function anonymousDb() {
  return testEnv.unauthenticatedContext().firestore();
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
 * Builds dynamic timestamps relative to test execution time.
 * @param {object} [options] - Builder options.
 * @param {number} [options.startOffsetMs] - Event start offset from now.
 * @param {number} [options.deadlineOffsetMs] - Registration deadline offset from now.
 * @returns {{
 *   now: import('firebase/firestore').Timestamp,
 *   time: import('firebase/firestore').Timestamp,
 *   registrationDeadline: import('firebase/firestore').Timestamp,
 * }} Timestamp fixture.
 */
function buildEventTimestampFixture({
  startOffsetMs = ONE_HOUR_MS,
  deadlineOffsetMs = -ONE_HOUR_MS,
} = {}) {
  const nowMs = Date.now();
  return {
    now: Timestamp.fromMillis(nowMs),
    time: Timestamp.fromMillis(nowMs + startOffsetMs),
    registrationDeadline: Timestamp.fromMillis(nowMs + deadlineOffsetMs),
  };
}

/**
 * Builds an event fixture for started-lock rules tests.
 * @param {Record<string, unknown>} [overrides] - Field overrides.
 * @returns {Record<string, unknown>} Event document data.
 */
function buildEventFixture(overrides = {}) {
  const timestamps = buildEventTimestampFixture();
  return {
    hostUid: 'event-host',
    title: 'City run',
    time: timestamps.time,
    registrationDeadline: timestamps.registrationDeadline,
    city: '台北市',
    district: '大安區',
    meetPlace: '森林公園',
    distanceKm: 5,
    maxParticipants: 20,
    participantsCount: 1,
    remainingSeats: 19,
    paceSec: 360,
    runType: 'easy',
    description: 'Morning run',
    ...overrides,
  };
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
 * Seeds one event document.
 * @param {string} eventId - Event id.
 * @param {Record<string, unknown>} [overrides] - Event field overrides.
 * @returns {Promise<void>} Seed completion.
 */
async function seedEvent(eventId, overrides = {}) {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, 'events', eventId), buildEventFixture(overrides));
  });
}

/**
 * Seeds one event participant document.
 * @param {string} eventId - Event id.
 * @param {string} uid - Participant uid.
 * @returns {Promise<void>} Seed completion.
 */
async function seedEventParticipant(eventId, uid) {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, 'events', eventId, 'participants', uid), {
      uid,
      eventId,
      name: 'Runner',
      photoURL: '',
    });
  });
}

/**
 * Builds a host body update payload with a future resulting start time.
 * @param {Record<string, unknown>} [overrides] - Field overrides.
 * @returns {Record<string, unknown>} Firestore update payload.
 */
function hostBodyUpdatePayload(overrides = {}) {
  return {
    title: 'Updated city run',
    ...overrides,
  };
}

/**
 * Builds a document reference for an event.
 * @param {import('firebase/firestore').Firestore} db - Firestore client.
 * @param {string} eventId - Event id.
 * @returns {import('firebase/firestore').DocumentReference} Event document reference.
 */
function eventDoc(db, eventId) {
  return doc(db, 'events', eventId);
}

describe('event start-lock Firestore rules shell', () => {
  it('builds event timestamps dynamically around the current test time', () => {
    const fixture = buildEventTimestampFixture();

    expect(fixture.time.toMillis()).toBeGreaterThan(fixture.now.toMillis());
    expect(fixture.registrationDeadline.toMillis()).toBeLessThan(fixture.now.toMillis());
  });

  it('loads rules and seeded future event fixtures through the emulator shell', async () => {
    await seedEvent('event-1');

    const snapshot = await assertSucceeds(getDoc(doc(dbFor('runner-1'), 'events', 'event-1')));

    expect(snapshot.exists()).toBe(true);
    expect(snapshot.data()?.title).toBe('City run');
  });
});

describe('host event body start-lock rules', () => {
  it('allows host body updates before the persisted event start', async () => {
    const timestamps = buildEventTimestampFixture({
      startOffsetMs: ONE_HOUR_MS,
    });
    await seedEvent('event-before-start', {
      time: timestamps.time,
    });

    await assertSucceeds(
      updateDoc(
        doc(dbFor('event-host'), 'events', 'event-before-start'),
        hostBodyUpdatePayload({
          time: Timestamp.fromMillis(timestamps.time.toMillis() + ONE_HOUR_MS),
        }),
      ),
    );
  });

  it('allows host max participant edits before start with derived remaining seats', async () => {
    await seedEvent('event-max-participants', {
      time: Timestamp.fromMillis(Date.now() + ONE_HOUR_MS),
      maxParticipants: 20,
      participantsCount: 3,
      remainingSeats: 17,
    });

    await assertSucceeds(
      updateDoc(
        doc(dbFor('event-host'), 'events', 'event-max-participants'),
        hostBodyUpdatePayload({
          maxParticipants: 25,
          remainingSeats: 22,
        }),
      ),
    );
  });

  it('denies host body updates at the resulting event start boundary', async () => {
    await seedEvent('event-at-start', {
      time: Timestamp.fromMillis(Date.now() + ONE_HOUR_MS),
    });

    await assertFails(
      updateDoc(
        doc(dbFor('event-host'), 'events', 'event-at-start'),
        hostBodyUpdatePayload({
          time: serverTimestamp(),
        }),
      ),
    );
  });

  it('denies host body updates after the persisted event start', async () => {
    await seedEvent('event-after-start', {
      time: Timestamp.fromMillis(Date.now() - ONE_HOUR_MS),
    });

    await assertFails(
      updateDoc(
        doc(dbFor('event-host'), 'events', 'event-after-start'),
        hostBodyUpdatePayload(),
      ),
    );
  });

  it('denies stale host body updates submitted after the persisted event start', async () => {
    await seedEvent('event-stale-submit', {
      time: Timestamp.fromMillis(Date.now() - FIVE_MINUTES_MS),
    });

    await assertFails(
      updateDoc(
        doc(dbFor('event-host'), 'events', 'event-stale-submit'),
        hostBodyUpdatePayload(),
      ),
    );
  });

  it('denies host body updates when the resulting event start is not future', async () => {
    await seedEvent('event-resulting-past', {
      time: Timestamp.fromMillis(Date.now() + ONE_HOUR_MS),
    });

    await assertFails(
      updateDoc(
        doc(dbFor('event-host'), 'events', 'event-resulting-past'),
        hostBodyUpdatePayload({
          time: Timestamp.fromMillis(Date.now() - ONE_HOUR_MS),
        }),
      ),
    );
  });
});

describe('non-host event permission priority across start timing', () => {
  it.each(START_TIMING_CASES)(
    'denies non-host body updates %s',
    async (_label, startOffsetMs) => {
      const eventId = `non-host-update-${startOffsetMs}`;
      const timestamps = buildEventTimestampFixture({ startOffsetMs });
      await seedEvent(eventId, {
        time: timestamps.time,
      });

      await assertFails(
        updateDoc(
          eventDoc(dbFor('runner-1'), eventId),
          hostBodyUpdatePayload({
            time: Timestamp.fromMillis(Date.now() + ONE_HOUR_MS),
          }),
        ),
      );
    },
  );

  it.each(START_TIMING_CASES)(
    'denies unauthenticated body updates %s',
    async (_label, startOffsetMs) => {
      const eventId = `anonymous-update-${startOffsetMs}`;
      const timestamps = buildEventTimestampFixture({ startOffsetMs });
      await seedEvent(eventId, {
        time: timestamps.time,
      });

      await assertFails(
        updateDoc(
          eventDoc(anonymousDb(), eventId),
          hostBodyUpdatePayload({
            time: Timestamp.fromMillis(Date.now() + ONE_HOUR_MS),
          }),
        ),
      );
    },
  );

  it.each(START_TIMING_CASES)(
    'denies non-host soft-delete updates %s',
    async (_label, startOffsetMs) => {
      const eventId = `non-host-soft-delete-${startOffsetMs}`;
      const timestamps = buildEventTimestampFixture({ startOffsetMs });
      await seedEvent(eventId, {
        time: timestamps.time,
      });

      await assertFails(
        updateDoc(
          eventDoc(dbFor('runner-1'), eventId),
          softDeletePayload('runner-1'),
        ),
      );
    },
  );

  it.each(START_TIMING_CASES)(
    'denies unauthenticated soft-delete updates %s',
    async (_label, startOffsetMs) => {
      const eventId = `anonymous-soft-delete-${startOffsetMs}`;
      const timestamps = buildEventTimestampFixture({ startOffsetMs });
      await seedEvent(eventId, {
        time: timestamps.time,
      });

      await assertFails(
        updateDoc(
          eventDoc(anonymousDb(), eventId),
          softDeletePayload('anonymous-user'),
        ),
      );
    },
  );
});

describe('started event non-body participant counter rules', () => {
  it('allows participant join counter updates after start when participant create is allowed', async () => {
    const eventId = 'started-counter-join';
    await seedEvent(eventId, {
      time: Timestamp.fromMillis(Date.now() - ONE_HOUR_MS),
      maxParticipants: 20,
      participantsCount: 1,
      remainingSeats: 19,
    });

    const db = dbFor('runner-2');
    const batch = writeBatch(db);
    batch.set(doc(db, 'events', eventId, 'participants', 'runner-2'), {
      uid: 'runner-2',
      eventId,
      name: 'Late runner',
      photoURL: '',
    });
    batch.update(eventDoc(db, eventId), {
      participantsCount: 2,
      remainingSeats: 18,
    });

    await assertSucceeds(batch.commit());
  });

  it('allows participant leave counter updates after start when participant delete is allowed', async () => {
    const eventId = 'started-counter-leave';
    await seedEvent(eventId, {
      time: Timestamp.fromMillis(Date.now() - ONE_HOUR_MS),
      maxParticipants: 20,
      participantsCount: 1,
      remainingSeats: 19,
    });
    await seedEventParticipant(eventId, 'runner-1');

    const db = dbFor('runner-1');
    const batch = writeBatch(db);
    batch.delete(doc(db, 'events', eventId, 'participants', 'runner-1'));
    batch.update(eventDoc(db, eventId), {
      participantsCount: 0,
      remainingSeats: 20,
    });

    await assertSucceeds(batch.commit());
  });
});
