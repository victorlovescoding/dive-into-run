/**
 * @file Playwright global setup for Posts UI E2E tests.
 * @description
 * Creates test users in the Auth Emulator and seeds Firestore with test posts.
 * Prerequisite: `firebase emulators:start` must be running before executing E2E tests.
 */

const PROJECT_ID = 'demo-dive-into-run';
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
 * @param {string} collectionPath - Full collection path (e.g. 'posts').
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
 * Playwright global setup: creates test accounts and seeds test posts in the Firebase Emulator.
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
  const clearAuthRes = await fetch(
    `${AUTH_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`,
    { method: 'DELETE' },
  );
  if (!clearAuthRes.ok) {
    throw new Error(`Failed to clear auth accounts: ${await clearAuthRes.text()}`);
  }

  // Clear all Firestore emulator documents
  const clearFsRes = await fetch(
    `${FIRESTORE_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!clearFsRes.ok) {
    throw new Error(`Failed to clear Firestore documents: ${await clearFsRes.text()}`);
  }

  // Create test user
  const { localId: authorUid, idToken: authorToken } = await createTestUser(
    'test-author@example.com',
    'test-password',
    'Test Author',
  );

  // Seed 2 posts owned by test-author
  await seedDoc(
    'posts',
    'test-post-1',
    {
      authorUid,
      authorName: 'Test Author',
      authorImgURL: '',
      title: 'E2E 測試文章一',
      content: '這是第一篇測試文章的內容，用於驗證文章列表顯示。',
      postAt: ts('2026-04-10T10:00:00Z'),
      likesCount: 3,
      commentsCount: 1,
    },
    authorToken,
  );

  await seedDoc(
    'posts',
    'test-post-2',
    {
      authorUid,
      authorName: 'Test Author',
      authorImgURL: '',
      title: 'E2E 測試文章二',
      content: '這是第二篇測試文章的內容，用於驗證文章詳細頁功能。',
      postAt: ts('2026-04-11T14:30:00Z'),
      likesCount: 0,
      commentsCount: 0,
    },
    authorToken,
  );
}
