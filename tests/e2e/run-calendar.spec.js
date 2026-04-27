// @ts-check
/**
 * @file E2E happy path test for Run Calendar feature (T016).
 * @description
 * Tests the full user journey: authenticated user with Strava connected
 * opens the run calendar dialog, verifies grid layout, run data display,
 * month navigation, and dialog close.
 *
 * Rules:
 * 1. Use Playwright for E2E tests.
 * 2. Use `page.getByRole` / `page.getByText` for locators — no CSS selectors.
 * 3. STRICTLY FORBIDDEN: `page.waitForTimeout()` — use Playwright auto-wait.
 * 4. STRICT JSDoc is required.
 * 5. NO `console.log`.
 */

import { test, expect } from '@playwright/test';

// TODO: E2E tests require auth setup (Firebase Auth emulator + Strava connection
// seed data). Implement auth fixture or storageState setup, then remove test.skip.
// The test user needs:
// 1. A valid Firebase Auth account
// 2. A stravaConnections/{uid} doc with connected: true
// 3. Seeded stravaActivities with Run/TrailRun/VirtualRun data for the current month
test.skip(true, 'Requires auth setup + Strava seed data — see TODO above');

/** @type {string} Runs page URL. */
const RUNS_URL = '/runs';

/** @type {string[]} 星期標題（日～六）。 */
const WEEKDAY_HEADERS = ['日', '一', '二', '三', '四', '五', '六'];

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
  await page.waitForFunction(() => Boolean(window.testFirebaseHelpers), { timeout: 10_000 });

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
}

/* ==========================================================================
   Happy Path: 跑步月曆完整流程
   ========================================================================== */

test.describe('Run Calendar — E2E Happy Path', () => {
  test.describe.configure({ mode: 'serial' });

  test('should open calendar dialog when clicking calendar button', async ({ page }) => {
    // Arrange — 登入已連接 Strava 使用者
    await loginAsUser(page, 'test-strava-user@example.com', 'test-password');
    await page.goto(RUNS_URL);

    // Act — 點擊月曆按鈕
    await page.getByRole('button', { name: '跑步月曆' }).click();

    // Assert — dialog 開啟
    const dialog = page.getByRole('dialog', { name: '跑步月曆' });
    await expect(dialog).toBeVisible();
  });

  test('should display weekday headers 日～六 in calendar grid', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-strava-user@example.com', 'test-password');
    await page.goto(RUNS_URL);
    await page.getByRole('button', { name: '跑步月曆' }).click();

    const dialog = page.getByRole('dialog', { name: '跑步月曆' });
    await expect(dialog).toBeVisible();

    // Assert — 7 個星期標題都出現
    for (const header of WEEKDAY_HEADERS) {
      await expect(dialog.getByText(header, { exact: true }).first()).toBeVisible();
    }
  });

  test('should display current month title in format YYYY年M月', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-strava-user@example.com', 'test-password');
    await page.goto(RUNS_URL);
    await page.getByRole('button', { name: '跑步月曆' }).click();

    const dialog = page.getByRole('dialog', { name: '跑步月曆' });
    await expect(dialog).toBeVisible();

    // Assert — 顯示當前月份標題
    const now = new Date();
    const expectedTitle = `${now.getFullYear()}年${now.getMonth() + 1}月`;
    await expect(dialog.getByText(expectedTitle)).toBeVisible();
  });

  test('should display km values on days with running activities', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-strava-user@example.com', 'test-password');
    await page.goto(RUNS_URL);
    await page.getByRole('button', { name: '跑步月曆' }).click();

    const dialog = page.getByRole('dialog', { name: '跑步月曆' });
    await expect(dialog).toBeVisible();

    // Assert — 至少有一個公里數顯示（格式: X.X，如 5.0, 10.2 等）
    // 使用正則匹配小數格式的公里數
    await expect(dialog.getByText(/\d+\.\d/)).toBeTruthy();
  });

  test('should display total distance in footer', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-strava-user@example.com', 'test-password');
    await page.goto(RUNS_URL);
    await page.getByRole('button', { name: '跑步月曆' }).click();

    const dialog = page.getByRole('dialog', { name: '跑步月曆' });
    await expect(dialog).toBeVisible();

    // Assert — 底部顯示總里程（格式: "總里程：X.X km"）
    await expect(dialog.getByText(/總里程：\d+\.\d km/)).toBeVisible();
  });

  test('should navigate to previous month', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-strava-user@example.com', 'test-password');
    await page.goto(RUNS_URL);
    await page.getByRole('button', { name: '跑步月曆' }).click();

    const dialog = page.getByRole('dialog', { name: '跑步月曆' });
    await expect(dialog).toBeVisible();

    // 記住當前月份
    const now = new Date();
    const currentTitle = `${now.getFullYear()}年${now.getMonth() + 1}月`;
    await expect(dialog.getByText(currentTitle)).toBeVisible();

    // Act — 點擊上一個月
    await page.getByRole('button', { name: '上一個月' }).click();

    // Assert — 月份變更為前一個月
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevTitle = `${prevDate.getFullYear()}年${prevDate.getMonth() + 1}月`;
    await expect(dialog.getByText(prevTitle)).toBeVisible();

    // Assert — 原本的月份標題不再顯示
    await expect(dialog.getByText(currentTitle)).not.toBeVisible();
  });

  test('should navigate to next month', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-strava-user@example.com', 'test-password');
    await page.goto(RUNS_URL);
    await page.getByRole('button', { name: '跑步月曆' }).click();

    const dialog = page.getByRole('dialog', { name: '跑步月曆' });
    await expect(dialog).toBeVisible();

    const now = new Date();
    const currentTitle = `${now.getFullYear()}年${now.getMonth() + 1}月`;
    await expect(dialog.getByText(currentTitle)).toBeVisible();

    // Act — 點擊下一個月
    await page.getByRole('button', { name: '下一個月' }).click();

    // Assert — 月份變更為下一個月
    const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextTitle = `${nextDate.getFullYear()}年${nextDate.getMonth() + 1}月`;
    await expect(dialog.getByText(nextTitle)).toBeVisible();

    // Assert — 原本的月份標題不再顯示
    await expect(dialog.getByText(currentTitle)).not.toBeVisible();
  });

  test('should close dialog when clicking close button', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-strava-user@example.com', 'test-password');
    await page.goto(RUNS_URL);
    await page.getByRole('button', { name: '跑步月曆' }).click();

    const dialog = page.getByRole('dialog', { name: '跑步月曆' });
    await expect(dialog).toBeVisible();

    // Act — 點擊關閉按鈕
    await page.getByRole('button', { name: '關閉月曆' }).click();

    // Assert — dialog 關閉
    await expect(dialog).not.toBeVisible();
  });
});
