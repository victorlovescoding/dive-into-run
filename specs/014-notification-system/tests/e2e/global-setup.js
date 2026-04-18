/**
 * @file Playwright global setup for Notification System E2E tests.
 * @description
 * Creates test users in the Auth Emulator and seeds Firestore with test data:
 * - 3 users (host, participant, post author)
 * - 1 event owned by host, with participant enrolled
 * - 1 post authored by post author
 *
 * Prerequisite: `firebase emulators:start --only auth,firestore` must be running.
 */

const PROJECT_ID = 'dive-into-run';
const AUTH_EMULATOR_URL = 'http://localhost:9099';
const FIRESTORE_EMULATOR_URL = 'http://localhost:8080';

/**
 * Wraps a raw ISO timestamp string into the Firestore REST API value format.
 * @param {string} isoString - ISO 8601 timestamp string.
 * @returns {{ timestampValue: string }} Firestore timestamp value.
 */
function ts(isoString) {
  return { timestampValue: isoString };
}

/**
 * Converts a plain data object to Firestore REST API document format.
 * Supports: string, integer, double, boolean, null, and pre-formatted Firestore values.
 * @param {Record<string, unknown>} data - Plain object to convert.
 * @returns {{ fields: Record<string, unknown> }} Firestore REST document body.
 */
function toFirestoreDoc(data) {
  /** @type {Record<string, unknown>} */
  const fields = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== null && typeof value === 'object' && 'timestampValue' in value) {
      fields[key] = value;
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number' && Number.isInteger(value)) {
      fields[key] = { integerValue: String(value) };
    } else if (typeof value === 'number') {
      fields[key] = { doubleValue: value };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (value === null) {
      fields[key] = { nullValue: 'NULL_VALUE' };
    }
  });
  return { fields };
}

/**
 * Creates a test user in the Auth Emulator.
 * @param {string} email - User email address.
 * @param {string} password - User password.
 * @param {string} displayName - User display name.
 * @returns {Promise<{ localId: string, idToken: string }>} Created user info with UID and token.
 */
async function createTestUser(email, password, displayName) {
  const res = await fetch(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to create test user ${email}: ${await res.text()}`);
  }
  return /** @type {Promise<{ localId: string, idToken: string }>} */ (res.json());
}

/**
 * Creates or replaces a Firestore document in the Emulator.
 * Supports top-level collections and subcollections via the collection path.
 * @param {string} collectionPath - Full collection path (e.g. 'events' or 'events/docId/participants').
 * @param {string} docId - Document ID.
 * @param {Record<string, unknown>} data - Document data.
 * @param {string} idToken - Firebase Auth ID token for the request (must satisfy security rules).
 * @returns {Promise<void>}
 */
async function seedDoc(collectionPath, docId, data, idToken) {
  const url = `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}/${docId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(toFirestoreDoc(data)),
  });
  if (!res.ok) {
    throw new Error(`Failed to seed ${collectionPath}/${docId}: ${await res.text()}`);
  }
}

/**
 * Playwright global setup: creates 3 test accounts and seeds event, participant, and post data.
 * @returns {Promise<void>}
 */
export default async function globalSetup() {
  // Verify emulator is running
  try {
    await fetch(`${AUTH_EMULATOR_URL}/`);
  } catch {
    throw new Error(
      'Firebase Auth Emulator is not running.\n' +
        '   Run: firebase emulators:start --only auth,firestore',
    );
  }

  // Clear all emulator auth accounts
  const authCleanup = await fetch(
    `${AUTH_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`,
    {
      method: 'DELETE',
    },
  );
  if (!authCleanup.ok) {
    console.warn(`Auth cleanup failed (${authCleanup.status}): ${await authCleanup.text()}`);
  }

  // Clear all Firestore emulator documents
  const firestoreCleanup = await fetch(
    `${FIRESTORE_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!firestoreCleanup.ok) {
    console.warn(
      `Firestore cleanup failed (${firestoreCleanup.status}): ${await firestoreCleanup.text()}`,
    );
  }

  // Create 3 test accounts
  const { localId: hostUid, idToken: hostToken } = await createTestUser(
    'test-host@example.com',
    'test-password',
    'Test Host',
  );
  const { localId: participantUid, idToken: participantToken } = await createTestUser(
    'test-participant@example.com',
    'test-password',
    'Test Participant',
  );
  const { localId: authorUid, idToken: authorToken } = await createTestUser(
    'test-author@example.com',
    'test-password',
    'Test Author',
  );

  // Seed user docs — loginCheckUserData auto-creates on login, but seeding
  // ensures data is available before any Firestore queries reference these users.
  await seedDoc(
    'users',
    hostUid,
    {
      name: 'Test Host',
      email: 'test-host@example.com',
      photoURL: '',
    },
    hostToken,
  );

  await seedDoc(
    'users',
    participantUid,
    {
      name: 'Test Participant',
      email: 'test-participant@example.com',
      photoURL: '',
    },
    participantToken,
  );

  await seedDoc(
    'users',
    authorUid,
    {
      name: 'Test Author',
      email: 'test-author@example.com',
      photoURL: '',
    },
    authorToken,
  );

  // Seed 1 event owned by host
  await seedDoc(
    'events',
    'test-event-notif',
    {
      title: 'E2E 通知測試活動',
      city: '台北市',
      district: '信義區',
      meetPlace: '象山捷運站',
      runType: 'road',
      distanceKm: 5.0,
      paceSec: 360,
      maxParticipants: 10,
      participantsCount: 1,
      remainingSeats: 9,
      description: '通知系統 E2E 測試用活動',
      hostUid,
      hostName: 'Test Host',
      hostPhotoURL: '',
      time: ts('2026-05-15T10:00:00Z'),
      registrationDeadline: ts('2026-05-14T23:59:59Z'),
      createdAt: ts('2026-04-01T00:00:00Z'),
    },
    hostToken,
  );

  // Seed participant into the event
  await seedDoc(
    'events/test-event-notif/participants',
    participantUid,
    {
      uid: participantUid,
      eventId: 'test-event-notif',
      name: 'Test Participant',
      photoURL: '',
      joinedAt: ts('2026-04-02T00:00:00Z'),
    },
    participantToken,
  );

  // Seed 1 post by test-author
  await seedDoc(
    'posts',
    'test-post-notif',
    {
      title: 'E2E 通知測試文章',
      content: '這是通知系統 E2E 測試用文章內容',
      authorUid,
      authorImgURL: '',
      postAt: ts('2026-04-01T00:00:00Z'),
      likesCount: 0,
      commentsCount: 0,
    },
    authorToken,
  );
}
