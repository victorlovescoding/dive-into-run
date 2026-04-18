/**
 * @file Playwright global setup for 001-event-filtering E2E tests using Firebase Emulator.
 * @description
 * Creates a test user in the Auth Emulator and seeds Firestore with test events
 * that have varied city/district/distanceKm values for meaningful filter testing.
 * Prerequisite: `firebase emulators:start` must be running before executing E2E tests.
 */

const PROJECT_ID = 'dive-into-run';
const AUTH_EMULATOR_URL = 'http://localhost:9099';
const FIRESTORE_EMULATOR_URL = 'http://localhost:8080';

/**
 * Wraps a raw ISO string into the Firestore REST API timestamp format.
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
 * @param {string} email - User's email address.
 * @param {string} password - User's password.
 * @param {string} displayName - User's display name.
 * @returns {Promise<{ localId: string, idToken: string }>} Created user info with auth token.
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
 * Creates or replaces a Firestore document in the Emulator via REST API.
 * @param {string} collection - Firestore collection ID.
 * @param {string} docId - Document ID.
 * @param {Record<string, unknown>} data - Document data as plain object.
 * @param {string} idToken - Firebase Auth ID token for authorization.
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
 * Playwright global setup: creates a test account and seeds test events
 * with varied city/district/distance values for filter E2E testing.
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
    { method: 'DELETE' },
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

  // Create test user
  const { localId: hostUid, idToken } = await createTestUser(
    'filter-test-host@example.com',
    'test-password',
    'Filter Test Host',
  );

  /** @type {Record<string, unknown>} */
  const baseEvent = {
    hostUid,
    hostName: 'Filter Test Host',
    hostPhotoURL: '',
    runType: 'road',
    maxParticipants: 10,
    participantsCount: 0,
    remainingSeats: 10,
    description: 'E2E 篩選測試用活動',
    createdAt: ts('2026-04-01T00:00:00Z'),
  };

  // Event 1: 台北市信義區, 5km — 讓 city/district 篩選有資料
  await seedDoc(
    'events',
    'filter-event-1',
    {
      ...baseEvent,
      title: 'E2E 篩選活動一',
      city: '台北市',
      district: '信義區',
      meetPlace: '象山捷運站',
      distanceKm: 5.0,
      paceSec: 360,
      time: ts('2027-06-15T08:00:00Z'),
      registrationDeadline: ts('2027-06-14T23:59:59Z'),
    },
    idToken,
  );

  // Event 2: 桃園市龜山區, 10km — 讓 city/district 連動和距離篩選有差異
  await seedDoc(
    'events',
    'filter-event-2',
    {
      ...baseEvent,
      title: 'E2E 篩選活動二',
      city: '桃園市',
      district: '龜山區',
      meetPlace: '體育大學',
      distanceKm: 10.0,
      paceSec: 330,
      time: ts('2027-07-20T07:00:00Z'),
      registrationDeadline: ts('2027-07-19T23:59:59Z'),
    },
    idToken,
  );
}
