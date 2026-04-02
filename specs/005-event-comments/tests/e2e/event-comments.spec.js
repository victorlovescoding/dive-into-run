// @ts-check
/**
 * @file E2E Test for Event Comments Feature
 * @description
 * TDD RED phase — Playwright tests for event comment flows that are NOT implemented yet.
 * Covers full user journeys for:
 * - User Story 1: 瀏覽留言
 * - User Story 2: 發表留言
 * - User Story 3: 編輯留言與編輯記錄
 * - User Story 4: 刪除留言
 *
 * Rules:
 * 1. Use Playwright for E2E tests.
 * 2. Use `page.getByRole` / `page.getByText` for locators — no CSS selectors.
 * 3. STRICTLY FORBIDDEN: `page.waitForTimeout()` — use Playwright auto-wait.
 * 4. STRICT JSDoc is required.
 * 5. NO `console.log`.
 */

import { test, expect } from '@playwright/test';

// Run all tests in this file serially to avoid Firestore state conflicts
test.describe.configure({ mode: 'serial' });

/** @type {string} Seeded event detail page URL. */
const EVENT_URL = '/events/test-event-comments';

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
  await page.waitForFunction(() => Boolean(window.testFirebaseHelpers), { timeout: 10000 });

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
 * Posts a new comment with unique text and returns that text for later assertion.
 * @param {import('@playwright/test').Page} page - Playwright page object.
 * @param {string} [prefix] - Optional prefix for the comment content.
 * @returns {Promise<string>} The unique comment text that was submitted.
 */
async function postUniqueComment(page, prefix = '自動測試留言') {
  const uniqueText = `${prefix} ${Date.now()}`;
  const textbox = page.getByRole('textbox');
  await textbox.fill(uniqueText);
  await page.getByRole('button', { name: /送出/i }).click();
  await expect(page.getByText(uniqueText)).toBeVisible();
  return uniqueText;
}

/* ==========================================================================
   US1: 瀏覽留言
   ========================================================================== */

test.describe('Event Comments — US1: 瀏覽留言', () => {
  test('should display existing comments on event detail page [US1-AC1]', async ({ page }) => {
    // Arrange & Act
    await page.goto(EVENT_URL);

    // Assert — 留言區可見且兩則 seed 留言都出現
    await expect(page.getByText('主揪的測試留言')).toBeVisible();
    await expect(page.getByText('留言者的測試留言')).toBeVisible();
  });

  test('should hide comment input for unauthenticated user [US1-AC4, FR-025]', async ({ page }) => {
    // Arrange & Act — 不登入直接訪問
    await page.goto(EVENT_URL);

    // Assert — 留言可見
    await expect(page.getByText('主揪的測試留言')).toBeVisible();

    // Assert — 沒有留言輸入框
    await expect(page.getByRole('textbox')).toHaveCount(0);
  });
});

/* ==========================================================================
   US2: 發表留言
   ========================================================================== */

test.describe('Event Comments — US2: 發表留言', () => {
  test('should post a new comment and see it at top of list [US2-AC1, FR-008, FR-010]', async ({
    page,
  }) => {
    // Arrange
    await loginAsUser(page, 'test-commenter@example.com', 'test-password');
    await page.goto(EVENT_URL);

    // Act — 輸入留言並送出
    const uniqueText = `新留言測試 ${Date.now()}`;
    const textbox = page.getByRole('textbox');
    await textbox.fill(uniqueText);
    await page.getByRole('button', { name: /送出/i }).click();

    // Assert — 新留言出現
    await expect(page.getByText(uniqueText)).toBeVisible();

    // Assert — 輸入框清空
    await expect(textbox).toHaveValue('');
  });

  test('should disable submit button when input is empty [US2-AC2, FR-006]', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-commenter@example.com', 'test-password');
    await page.goto(EVENT_URL);

    // Assert — 初始狀態 disabled
    const submitButton = page.getByRole('button', { name: /送出/i });
    await expect(submitButton).toBeDisabled();
  });
});

/* ==========================================================================
   US3: 編輯留言
   ========================================================================== */

test.describe('Event Comments — US3: 編輯留言', () => {
  test('author should see three-dot menu on own comment [US3-AC5, FR-017]', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-commenter@example.com', 'test-password');
    await page.goto(EVENT_URL);

    // Assert — 至少一個「更多操作」按鈕可見
    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await expect(menuButton).toBeVisible();
  });

  test('non-author should NOT see three-dot menu on others comments [FR-026]', async ({ page }) => {
    // Arrange — test-viewer 沒有自己的留言
    await loginAsUser(page, 'test-viewer@example.com', 'test-password');
    await page.goto(EVENT_URL);

    // Assert — 等頁面載完，不應有任何「更多操作」按鈕
    await expect(page.getByText('主揪的測試留言')).toBeVisible();
    await expect(page.getByRole('button', { name: /更多操作/i })).toHaveCount(0);
  });

  test('full edit flow: open modal → modify → save → see edited badge [US3-AC1~AC3]', async ({
    page,
  }) => {
    // Arrange
    await loginAsUser(page, 'test-commenter@example.com', 'test-password');
    await page.goto(EVENT_URL);

    // Act — 點選三點選單 → 編輯留言
    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /編輯留言/i }).click();

    // Assert — dialog 可見且有預填內容
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const textarea = dialog.getByRole('textbox');
    await expect(textarea).not.toHaveValue('');

    // Assert — 未修改時完成編輯 disabled
    const saveButton = page.getByRole('button', { name: /完成編輯/i });
    await expect(saveButton).toBeDisabled();

    // Act — 清空並輸入新內容
    const newContent = `已編輯內容 ${Date.now()}`;
    await textarea.clear();
    await textarea.fill(newContent);

    // Assert — 修改後 enabled
    await expect(saveButton).toBeEnabled();

    // Act — 儲存
    await saveButton.click();

    // Assert — dialog 關閉、新內容出現、已編輯 badge 可見
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(newContent)).toBeVisible();
    await expect(page.getByText('已編輯')).toBeVisible();
  });

  test('cancel edit should not change comment [US3-AC4]', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-commenter@example.com', 'test-password');
    await page.goto(EVENT_URL);

    // 開啟編輯 modal
    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /編輯留言/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 記住原文
    const textarea = dialog.getByRole('textbox');
    const originalText = await textarea.inputValue();

    // Act — 修改文字後取消
    await textarea.clear();
    await textarea.fill('不應該出現的留言內容');
    await page.getByRole('button', { name: /取消編輯/i }).click();

    // Assert — dialog 關閉，原文仍在
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(originalText)).toBeVisible();
    await expect(page.getByText('不應該出現的留言內容')).not.toBeVisible();
  });

  test('clicking edited badge should show edit history modal [US3-AC7, FR-015]', async ({
    page,
  }) => {
    // Arrange
    await loginAsUser(page, 'test-commenter@example.com', 'test-password');
    await page.goto(EVENT_URL);

    // Act — 點擊「已編輯」badge
    await page
      .getByRole('button', { name: /已編輯|查看編輯記錄/i })
      .first()
      .click();

    // Assert — 歷史記錄 dialog 可見且至少有 2 個版本
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 至少 2 個版本（原始 + 編輯後）
    const versionItems = dialog.getByRole('listitem');
    await expect(versionItems).toHaveCount(await versionItems.count());
    expect(await versionItems.count()).toBeGreaterThanOrEqual(2);
  });
});

/* ==========================================================================
   US4: 刪除留言
   ========================================================================== */

test.describe('Event Comments — US4: 刪除留言', () => {
  test('delete flow: confirm → comment removed [US4-AC1~AC2]', async ({ page }) => {
    // Arrange — 先發一則新留言供刪除
    await loginAsUser(page, 'test-commenter@example.com', 'test-password');
    await page.goto(EVENT_URL);
    const deleteTarget = await postUniqueComment(page, '待刪除留言');

    // Act — 找到對應留言的三點選單（最新留言在最上方）
    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /刪除留言/i }).click();

    // Assert — 確認 dialog 出現
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByText('確定刪除留言？')).toBeVisible();

    // Act — 確定刪除
    await page.getByRole('button', { name: /確定刪除/i }).click();

    // Assert — dialog 關閉、留言消失
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(deleteTarget)).not.toBeVisible();
  });

  test('cancel delete should keep comment intact [US4-AC4]', async ({ page }) => {
    // Arrange — 先發一則新留言
    await loginAsUser(page, 'test-commenter@example.com', 'test-password');
    await page.goto(EVENT_URL);
    const keepTarget = await postUniqueComment(page, '保留留言');

    // Act — 打開刪除確認
    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /刪除留言/i }).click();

    // Assert — dialog 可見
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Act — 取消刪除
    await page.getByRole('button', { name: /取消刪除/i }).click();

    // Assert — dialog 關閉、留言仍在
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(keepTarget)).toBeVisible();
  });
});
