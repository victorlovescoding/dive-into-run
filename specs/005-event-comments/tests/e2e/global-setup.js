/**
 * @file Playwright global setup for Event Comments E2E tests.
 * @description
 * Creates test users in the Auth Emulator and seeds Firestore with a test event
 * plus comment subcollection documents.
 * Prerequisite: `firebase emulators:start` must be running before executing E2E tests.
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
 * @param {string} collectionPath - Full collection path (e.g. 'events' or 'events/docId/comments').
 * @param {string} docId - Document ID.
 * @param {Record<string, unknown>} data - Document data.
 * @param {string} idToken - Firebase Auth ID token for the request.
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
 * Playwright global setup: creates 3 test accounts, seeds 1 event and 2 comments.
 * @returns {Promise<void>}
 */
export default async function globalSetup() {
  // Verify emulator is running
  try {
    await fetch(`${AUTH_EMULATOR_URL}/`);
  } catch {
    throw new Error(
      '❌ Firebase Auth Emulator is not running.\n' +
        '   Run: firebase emulators:start --only auth,firestore',
    );
  }

  // Clear all emulator auth accounts
  await fetch(`${AUTH_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE',
  });

  // Clear all Firestore emulator documents
  await fetch(
    `${FIRESTORE_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );

  // Create 3 test accounts
  const { localId: hostUid, idToken: hostToken } = await createTestUser(
    'test-host@example.com',
    'test-password',
    'Test Host',
  );
  const { localId: commenterUid, idToken: commenterToken } = await createTestUser(
    'test-commenter@example.com',
    'test-password',
    'Test Commenter',
  );
  await createTestUser('test-viewer@example.com', 'test-password', 'Test Viewer');

  // Seed 1 event owned by test-host
  await seedDoc(
    'events',
    'test-event-comments',
    {
      title: 'E2E 留言測試活動',
      city: '台北市',
      district: '大安區',
      meetPlace: '大安森林公園捷運站',
      runType: 'road',
      distanceKm: 5.0,
      paceSec: 360,
      maxParticipants: 10,
      participantsCount: 0,
      remainingSeats: 10,
      description: '留言功能 E2E 測試用活動',
      hostUid,
      hostName: 'Test Host',
      hostPhotoURL: '',
      time: ts('2026-04-15T10:00:00Z'),
      registrationDeadline: ts('2026-04-14T23:59:59Z'),
      createdAt: ts('2026-03-30T00:00:00Z'),
    },
    hostToken,
  );

  // Seed 2 comments in events/test-event-comments/comments subcollection
  const commentsPath = 'events/test-event-comments/comments';

  await seedDoc(
    commentsPath,
    'seed-comment-host',
    {
      authorUid: hostUid,
      authorName: 'Test Host',
      authorPhotoURL: '',
      content: '主揪的測試留言',
      createdAt: ts('2026-04-01T10:00:00Z'),
      updatedAt: null,
      isEdited: false,
    },
    hostToken,
  );

  await seedDoc(
    commentsPath,
    'seed-comment-commenter',
    {
      authorUid: commenterUid,
      authorName: 'Test Commenter',
      authorPhotoURL: '',
      content: '留言者的測試留言',
      createdAt: ts('2026-04-01T11:00:00Z'),
      updatedAt: null,
      isEdited: false,
    },
    commenterToken,
  );
}
