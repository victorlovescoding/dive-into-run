/* eslint @vitest/expect-expect: ["error", { "assertFunctionNames": ["expect", "assert", "assertSucceeds", "assertFails"] }] */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';

const PROJECT_ID = 'demo-test';
const RULES_PATH = 'firestore.rules';

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
 * Builds an event host join notification payload.
 * @param {Partial<{
 *   recipientUid: string,
 *   type: string,
 *   actorUid: string,
 *   actorName: string,
 *   actorPhotoURL: string,
 *   entityType: string,
 *   entityId: string,
 *   entityTitle: string,
 *   commentId: string | null,
 *   message: string,
 *   read: boolean,
 *   createdAt: import('firebase/firestore').FieldValue | import('firebase/firestore').Timestamp,
 * }>} [overrides] - Field overrides.
 * @returns {{
 *   recipientUid: string,
 *   type: string,
 *   actorUid: string,
 *   actorName: string,
 *   actorPhotoURL: string,
 *   entityType: string,
 *   entityId: string,
 *   entityTitle: string,
 *   commentId: string | null,
 *   message: string,
 *   read: boolean,
 *   createdAt: import('firebase/firestore').FieldValue | import('firebase/firestore').Timestamp,
 * }} Notification payload.
 */
function hostJoinNotificationPayload(overrides = {}) {
  return {
    recipientUid: 'host-1',
    type: 'event_host_joined',
    actorUid: 'runner-1',
    actorName: '小明',
    actorPhotoURL: '',
    entityType: 'event',
    entityId: 'event-1',
    entityTitle: '週末晨跑',
    commentId: null,
    message: '小明 報名了你的活動「週末晨跑」',
    read: false,
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

describe('notification Firestore rules', () => {
  it('allows authenticated actors to create event_host_joined notifications for another host', async () => {
    await assertSucceeds(
      setDoc(
        doc(dbFor('runner-1'), 'notifications', 'event-host-join-allowed'),
        hostJoinNotificationPayload(),
      ),
    );
  });

  it('denies event_host_joined self-notifications', async () => {
    await assertFails(
      setDoc(
        doc(dbFor('runner-1'), 'notifications', 'event-host-join-self'),
        hostJoinNotificationPayload({ recipientUid: 'runner-1' }),
      ),
    );
  });

  it('denies event_host_joined notifications when actorUid differs from auth uid', async () => {
    await assertFails(
      setDoc(
        doc(dbFor('runner-1'), 'notifications', 'event-host-join-wrong-actor'),
        hostJoinNotificationPayload({ actorUid: 'runner-2' }),
      ),
    );
  });

  it('denies event_host_joined notifications with a client supplied timestamp', async () => {
    await assertFails(
      setDoc(
        doc(dbFor('runner-1'), 'notifications', 'event-host-join-client-time'),
        hostJoinNotificationPayload({
          createdAt: Timestamp.fromDate(new Date('2026-05-30T00:00:00.000Z')),
        }),
      ),
    );
  });

  it('denies event_host_joined notifications created as already read', async () => {
    await assertFails(
      setDoc(
        doc(dbFor('runner-1'), 'notifications', 'event-host-join-read'),
        hostJoinNotificationPayload({ read: true }),
      ),
    );
  });
});
