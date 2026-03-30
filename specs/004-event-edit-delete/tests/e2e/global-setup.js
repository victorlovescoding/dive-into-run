/**
 * @file Playwright global setup for E2E tests using Firebase Emulator.
 * @description
 * Creates test users in the Auth Emulator and seeds Firestore with test events.
 * Prerequisite: `firebase emulators:start` must be running before executing E2E tests.
 */

const PROJECT_ID = 'dive-into-run';
const AUTH_EMULATOR_URL = 'http://localhost:9099';
const FIRESTORE_EMULATOR_URL = 'http://localhost:8080';

/**
 * Wraps a raw Firestore timestamp string into the REST API value format.
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
  for (const [key, value] of Object.entries(data)) {
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
  }
  return { fields };
}

/**
 * Creates a test user in the Auth Emulator.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 * @param {string} displayName - User's display name.
 * @returns {Promise<{ localId: string, idToken: string }>} Created user info.
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
 * @param {string} collection - Collection ID.
 * @param {string} docId - Document ID.
 * @param {Record<string, unknown>} data - Document data.
 * @param {string} idToken - Firebase Auth ID token for the request (must satisfy security rules).
 * @returns {Promise<void>}
 */
async function seedDoc(collection, docId, data, idToken) {
  const url = `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(toFirestoreDoc(data)),
  });
  if (!res.ok) {
    throw new Error(`Failed to seed ${collection}/${docId}: ${await res.text()}`);
  }
}

/**
 * Playwright global setup: creates test accounts and seeds test events in the Firebase Emulator.
 * @returns {Promise<void>}
 */
export default async function globalSetup() {
  // Verify emulator is running
  try {
    await fetch(`${AUTH_EMULATOR_URL}/`);
  } catch {
    throw new Error(
      '❌ Firebase Auth Emulator is not running.\n'
        + '   Run: firebase emulators:start --only auth,firestore',
    );
  }

  // Clear all emulator auth accounts
  await fetch(
    `${AUTH_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`,
    { method: 'DELETE' },
  );

  // Clear all Firestore emulator documents
  await fetch(
    `${FIRESTORE_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );

  // Create test accounts
  const { localId: testHostUid, idToken: hostIdToken } = await createTestUser(
    'test-host@example.com',
    'test-password',
    'Test Host',
  );
  await createTestUser('test-participant@example.com', 'test-password', 'Test Participant');

  // Seed 2 events owned by test-host (delete test removes one, leaving one for subsequent tests)
  /** @type {Record<string, unknown>} */
  const baseEvent = {
    city: '台北市',
    district: '信義區',
    meetPlace: '象山捷運站',
    runType: 'road',
    distanceKm: 5.0,
    paceSec: 360,
    maxParticipants: 10,
    participantsCount: 0,
    remainingSeats: 10,
    description: 'E2E 測試用活動，請勿操作',
    hostUid: testHostUid,
    hostName: 'Test Host',
    hostPhotoURL: '',
    registrationDeadline: ts('2026-04-14T23:59:59Z'),
    createdAt: ts('2026-03-30T00:00:00Z'),
  };

  await seedDoc('events', 'test-event-1', {
    ...baseEvent,
    title: 'E2E 測試活動一',
    time: ts('2026-04-15T10:00:00Z'),
  }, hostIdToken);

  await seedDoc('events', 'test-event-2', {
    ...baseEvent,
    title: 'E2E 測試活動二',
    time: ts('2026-04-16T10:00:00Z'),
  }, hostIdToken);
}
