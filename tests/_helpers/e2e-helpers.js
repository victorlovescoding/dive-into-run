/**
 * @file Shared E2E test helpers for Firebase Emulator-backed Playwright tests.
 * @description
 * Centralizes utilities used across all E2E global-setup and spec files:
 * - Emulator constants and admin headers
 * - Firestore REST API seeding (Bearer owner — bypasses security rules)
 * - Auth Emulator account creation and cleanup
 * - Playwright login helper
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PROJECT_ID = 'dive-into-run';
export const AUTH_EMULATOR_URL = 'http://localhost:9099';
export const FIRESTORE_EMULATOR_URL = 'http://localhost:8080';

/** @type {Record<string, string>} Emulator admin headers — bypasses security rules. */
const ADMIN_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer owner',
};

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

/**
 * Wraps a raw ISO string into the Firestore REST API timestamp format.
 * @param {string} isoString - ISO 8601 timestamp string.
 * @returns {{ timestampValue: string }} Firestore timestamp value.
 */
export function ts(isoString) {
  return { timestampValue: isoString };
}

/**
 * Converts a plain data object to Firestore REST API document format.
 * Supports: string, integer, double, boolean, null, and pre-formatted
 * Firestore values (e.g. `{ timestampValue: '...' }`).
 * @param {Record<string, unknown>} data - Plain object to convert.
 * @returns {{ fields: Record<string, unknown> }} Firestore REST document body.
 */
export function toFirestoreDoc(data) {
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
 * Seeds (creates or replaces) a Firestore document via the Emulator REST API.
 * Uses `Bearer owner` admin token to bypass security rules.
 * @param {string} collectionPath - Full collection path (e.g. 'events' or 'events/docId/comments').
 * @param {string} docId - Document ID.
 * @param {Record<string, unknown>} data - Document data as plain object.
 * @returns {Promise<void>}
 */
export async function seedDoc(collectionPath, docId, data) {
  const url = `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}/${docId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: ADMIN_HEADERS,
    body: JSON.stringify(toFirestoreDoc(data)),
  });
  if (!res.ok) {
    throw new Error(`Failed to seed ${collectionPath}/${docId}: ${await res.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Auth Emulator helpers
// ---------------------------------------------------------------------------

/**
 * Creates a test user in the Auth Emulator.
 * @param {string} email - User email address.
 * @param {string} password - User password.
 * @param {string} displayName - User display name.
 * @returns {Promise<{ localId: string, idToken: string }>} Created user info.
 */
export async function createTestUser(email, password, displayName) {
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
 * Clears all Auth accounts and Firestore documents in the Emulator.
 * Waits for both operations to complete before returning.
 * @returns {Promise<void>}
 */
export async function cleanupEmulator() {
  const [authRes, firestoreRes] = await Promise.all([
    fetch(`${AUTH_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
      method: 'DELETE',
    }),
    fetch(
      `${FIRESTORE_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      { method: 'DELETE' },
    ),
  ]);
  if (!authRes.ok) {
    console.warn(`Auth cleanup failed (${authRes.status}): ${await authRes.text()}`);
  }
  if (!firestoreRes.ok) {
    console.warn(`Firestore cleanup failed (${firestoreRes.status}): ${await firestoreRes.text()}`);
  }
}

/**
 * Verifies that the Firebase Emulator is running. Throws if not reachable.
 * @returns {Promise<void>}
 */
export async function verifyEmulatorRunning() {
  try {
    await fetch(`${AUTH_EMULATOR_URL}/`);
  } catch {
    throw new Error(
      'Firebase Auth Emulator is not running.\n' +
        '   Run: firebase emulators:start --only auth,firestore,storage',
    );
  }
}

// ---------------------------------------------------------------------------
// Playwright helpers
// ---------------------------------------------------------------------------

/**
 * Logs in a test user via the Firebase Auth Emulator helper exposed on window.
 * Navigates to the start page, signs in programmatically, reloads, and waits
 * for the page to be ready.
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @param {string} email - Test user email.
 * @param {string} password - Test user password.
 * @param {object} [options] - Login options.
 * @param {string} [options.startPage] - Page to navigate to before signing in (defaults to '/events').
 * @param {string} [options.waitForSelector] - Selector to wait for after reload.
 * @param {RegExp} [options.waitForText] - Text to wait for after reload.
 * @returns {Promise<void>}
 */
export async function loginAsUser(page, email, password, options = {}) {
  const { startPage = '/events', waitForSelector, waitForText } = options;

  await page.goto(startPage);
  await page.waitForFunction(() => Boolean(window.testFirebaseHelpers), { timeout: 10000 });

  await page.evaluate(
    async (/** @type {{ email: string, password: string }} */ creds) => {
      const { auth, signIn } = window.testFirebaseHelpers;
      await signIn(auth, creds.email, creds.password);
    },
    { email, password },
  );

  // Reload so React auth context picks up the persisted login state
  await page.reload();

  if (waitForSelector) {
    await page.locator(waitForSelector).waitFor({ timeout: 10000 });
  } else if (waitForText) {
    const { expect } = await import('@playwright/test');
    await expect(page.getByText(waitForText)).toBeVisible();
  }
}

/**
 * Signs out the current user via Firebase SDK.
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {Promise<void>}
 */
export async function signOutUser(page) {
  await page.evaluate(async () => {
    const { auth, signOut } = window.testFirebaseHelpers;
    await signOut(auth);
  });
}
