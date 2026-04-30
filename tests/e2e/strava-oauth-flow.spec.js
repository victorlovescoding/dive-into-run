// @ts-check
/**
 * @file E2E test — Strava OAuth flow (T-P1-3-04).
 * @description
 * Covers the user-visible OAuth flow with Firebase Emulator-backed auth/state:
 * - Logged-in user clicks connect, is redirected through mocked Strava OAuth,
 *   lands back on callback, then sees connected Runs UI and Firestore write.
 * - OAuth deny callback shows the missing-code error contract.
 *
 * Boundary note:
 * This E2E keeps Strava upstream mocked at the browser-visible boundary.
 * The callback API success response is fulfilled in-test while the Firestore
 * side-effect is written to the emulator via REST. The real callback route /
 * use-case stack is covered separately by T-P1-3-02.
 */

import { test, expect } from '@playwright/test';
import {
  FIRESTORE_EMULATOR_URL,
  PROJECT_ID,
  cleanupEmulator,
  createTestUser,
  loginAsUser,
  seedDoc,
  ts,
  verifyEmulatorRunning,
} from '../_helpers/e2e-helpers.js';

const TEST_PASSWORD = 'test-password';
const ATHLETE_NAME = 'Test Runner';
const EMAIL_RUN_ID = Date.now();
const CONNECT_EMAIL = `strava-oauth-connect-${EMAIL_RUN_ID}@example.com`;
const DENY_EMAIL = `strava-oauth-deny-${EMAIL_RUN_ID}@example.com`;
const ADMIN_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer owner',
};
const MISSING_CODE_MESSAGE = '授權失敗：未取得授權碼。';

/**
 * Builds a Firestore Emulator document URL.
 * @param {string} collectionPath - Collection path.
 * @param {string} docId - Document ID.
 * @returns {string} REST URL.
 */
function getDocUrl(collectionPath, docId) {
  return `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}/${docId}`;
}

/**
 * Reads a Firestore document from the emulator REST API.
 * @param {string} collectionPath - Collection path.
 * @param {string} docId - Document ID.
 * @returns {Promise<Record<string, unknown>>} Raw Firestore fields map.
 */
async function readDocFields(collectionPath, docId) {
  const response = await fetch(getDocUrl(collectionPath, docId), {
    headers: ADMIN_HEADERS,
  });
  if (!response.ok) {
    throw new Error(`Failed to read ${collectionPath}/${docId}: ${await response.text()}`);
  }
  const body = await response.json();
  return /** @type {{ fields?: Record<string, unknown> }} */ (body).fields ?? {};
}

/**
 * Mocks the browser navigation to Strava OAuth and redirects back to callback.
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @param {string} callbackQuery - Query string for the callback URL.
 * @returns {Promise<void>}
 */
async function mockAuthorizeRedirect(page, callbackQuery) {
  await page.route('https://www.strava.com/oauth/authorize**', async (route) => {
    await route.fulfill({
      status: 302,
      headers: { location: `http://localhost:3000/runs/callback?${callbackQuery}` },
      body: '',
    });
  });
}

/**
 * Mocks callback API success and writes the connected state into Firestore.
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @param {string} uid - Current user uid.
 * @returns {Promise<void>}
 */
async function mockCallbackSuccess(page, uid) {
  await page.route('**/api/strava/callback', async (route) => {
    const payload = route.request().postDataJSON();
    if (!payload || payload.code !== 'mock-auth-code') {
      throw new Error('Unexpected callback payload');
    }

    const nowIso = new Date().toISOString();
    await seedDoc('stravaConnections', uid, {
      connected: true,
      athleteId: 42,
      athleteName: ATHLETE_NAME,
      connectedAt: ts(nowIso),
      lastSyncAt: null,
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        athleteName: ATHLETE_NAME,
        syncedCount: 0,
      }),
    });
  });
}

test.describe('Strava OAuth Flow', () => {
  test.describe.configure({ mode: 'serial' });

  /** @type {string} */
  let connectUserUid;
  /** @type {string} */
  let denyUserUid;

  test.beforeAll(async () => {
    await verifyEmulatorRunning();
    await cleanupEmulator();

    const connectUser = await createTestUser(CONNECT_EMAIL, TEST_PASSWORD, 'Strava Connect User');
    const denyUser = await createTestUser(DENY_EMAIL, TEST_PASSWORD, 'Strava Deny User');
    connectUserUid = connectUser.localId;
    denyUserUid = denyUser.localId;

    await seedDoc('users', connectUserUid, {
      name: 'Strava Connect User',
      email: CONNECT_EMAIL,
      photoURL: '',
    });
    await seedDoc('users', denyUserUid, {
      name: 'Strava Deny User',
      email: DENY_EMAIL,
      photoURL: '',
    });

    // Marker doc keeps the collection present before the connected-state write.
    await seedDoc('stravaConnections', 'strava-oauth-marker', {
      connected: false,
      athleteId: 0,
      athleteName: 'marker',
      connectedAt: ts(new Date().toISOString()),
      lastSyncAt: null,
    });
  });

  test('logged-in user connects Strava, returns to runs page, and persists connection state', async ({
    page,
  }) => {
    await mockAuthorizeRedirect(page, 'code=mock-auth-code');
    await mockCallbackSuccess(page, connectUserUid);

    await loginAsUser(page, CONNECT_EMAIL, TEST_PASSWORD, {
      startPage: '/runs',
      waitForText: /連結你的 Strava 帳號/,
    });

    await expect(page.getByRole('heading', { name: '連結你的 Strava 帳號' })).toBeVisible();

    await page.getByRole('button', { name: '連結 Strava' }).click();

    await expect(page.getByText(ATHLETE_NAME)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '同步' })).toBeVisible();
    await expect(page.getByRole('button', { name: '取消連結' })).toBeVisible();
    await expect(page.getByRole('button', { name: '連結 Strava' })).not.toBeVisible();

    const fields = await readDocFields('stravaConnections', connectUserUid);

    expect(fields.connected).toEqual({ booleanValue: true });
    expect(fields.athleteName).toEqual({ stringValue: ATHLETE_NAME });
  });

  test('oauth deny callback shows the missing-code error contract', async ({ page }) => {
    await mockAuthorizeRedirect(page, 'error=access_denied');

    await loginAsUser(page, DENY_EMAIL, TEST_PASSWORD, {
      startPage: '/runs',
      waitForText: /連結你的 Strava 帳號/,
    });

    await page.getByRole('button', { name: '連結 Strava' }).click();

    await expect(page).toHaveURL(/\/runs\/callback\?error=access_denied/);
    await expect(page.getByRole('alert').filter({ hasText: MISSING_CODE_MESSAGE })).toHaveText(
      MISSING_CODE_MESSAGE,
    );
    await expect(page.getByRole('link', { name: '返回跑步頁面' })).toBeVisible();
  });
});
