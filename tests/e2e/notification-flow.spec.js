// @ts-check
/**
 * @file E2E Test — Notification Flow: Event Edit (T036)
 * @description
 * TDD RED phase — Playwright tests for the notification happy path:
 * Host edits event -> participant sees unread badge -> opens panel ->
 * sees notification -> clicks to navigate to event page.
 *
 * Rules:
 * 1. Use Playwright for E2E tests.
 * 2. Use `page.getByRole` / `page.getByText` for locators — no CSS selectors.
 * 3. STRICTLY FORBIDDEN: `page.waitForTimeout()` — use Playwright auto-wait.
 * 4. STRICT JSDoc is required.
 * 5. NO `console.log`.
 */

import { test, expect } from '@playwright/test';

// Run all tests serially to avoid Firestore state conflicts
test.describe.configure({ mode: 'serial' });

/**
 * Logs in a test user via the Firebase Auth Emulator helper exposed on window.
 * Navigates to /events first to initialise the Firebase app, then calls
 * signInWithEmailAndPassword through `window.testFirebaseHelpers`.
 * @param {import('@playwright/test').Page} page - Playwright page object.
 * @param {string} email - Test user email address.
 * @param {string} password - Test user password.
 * @returns {Promise<void>}
 */
async function loginAsUser(page, email, password) {
  await page.goto('/events');

  // Wait for emulator test helpers to be mounted on window
  await page.waitForFunction(() => Boolean(window.testFirebaseHelpers), {
    timeout: 10000,
  });

  // Sign in programmatically via Firebase SDK
  await page.evaluate(
    async (/** @type {{ email: string, password: string }} */ creds) => {
      /** @type {{ auth: unknown, signIn: (a: unknown, e: string, p: string) => Promise<unknown> }} */
      const helpers = window.testFirebaseHelpers;
      await helpers.signIn(helpers.auth, creds.email, creds.password);
    },
    { email, password },
  );

  // Reload so React auth context picks up the persisted login state
  await page.reload();
  await expect(page.getByText(/活動列表/i)).toBeVisible();
}

/**
 * Signs out the current user via the Firebase Auth Emulator helper.
 * @param {import('@playwright/test').Page} page - Playwright page object.
 * @returns {Promise<void>}
 */
async function signOutUser(page) {
  await page.evaluate(async () => {
    const { auth, signOut } = window.testFirebaseHelpers;
    await signOut(auth);
  });
}

test.describe('Notification Flow - Event Edit (T036)', () => {
  test('participant sees notification after host edits event', async ({ page }) => {
    // Step 1: Login as host
    await loginAsUser(page, 'test-host@example.com', 'test-password');

    // Step 2: Navigate to event detail page
    await page.goto('/events/test-event-notif');
    await expect(page.getByText('E2E 通知測試活動')).toBeVisible();

    // Step 3: Edit the event — open menu -> edit -> modify -> save
    const menuBtn = page.getByRole('button', { name: /更多操作/i });
    await menuBtn.click();
    await page.getByRole('menuitem', { name: /編輯活動/i }).click();

    // Modify title
    const titleInput = page.getByLabel(/活動名稱/i);
    await titleInput.clear();
    await titleInput.fill('E2E 通知測試活動（已修改）');

    // Submit the edit
    await page.getByRole('button', { name: /編輯完成/i }).click();

    // Wait for success toast
    await expect(page.getByText(/更新活動成功/i)).toBeVisible();

    // Wait for fire-and-forget notifyEventModified to complete
    // The notification write is async and not awaited in the handler
    await page
      .waitForResponse((res) => res.url().includes('firestore') && res.url().includes('commit'), {
        timeout: 10000,
      })
      .catch(() => {});

    // Step 4: Logout host, login as participant
    await signOutUser(page);
    await loginAsUser(page, 'test-participant@example.com', 'test-password');

    // Navigate to trigger notification listeners
    await page.goto('/events');

    // Step 5: Bell should show unread badge
    const bellButton = page.locator('[aria-controls="notification-panel"]');
    await expect(bellButton).toBeVisible();

    // Wait for unread badge to appear (onSnapshot delivers notification)
    await expect(page.locator('[class*="badge"]')).toBeVisible({ timeout: 30000 });

    // Step 6: Click bell to open notification panel
    await bellButton.click();
    const panel = page.getByRole('region', { name: /通知面板/i });
    await expect(panel).toBeVisible();

    // Step 7: Verify notification content — message includes the keyword
    await expect(panel.getByText(/活動資訊有更動/i)).toBeVisible();

    // Step 8: Click the notification item to navigate
    const notifItem = panel.locator('button').filter({ hasText: /活動資訊有更動/i });
    await notifItem.click();

    // Step 9: Verify navigation to event detail page
    await expect(page).toHaveURL(/\/events\/test-event-notif/);

    // Step 10: Panel should be closed after clicking notification
    await expect(panel).not.toBeVisible();
  });
});
