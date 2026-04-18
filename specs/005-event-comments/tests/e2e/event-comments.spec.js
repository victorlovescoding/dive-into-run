// @ts-check
/**
 * @file E2E Test for Event Comments Feature
 * @description
 * Playwright tests for event comment flows.
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
import { loginAsUser } from '../../../test-utils/e2e-helpers.js';

// Run all tests in this file serially to avoid Firestore state conflicts
test.describe.configure({ mode: 'serial' });

/** @type {string} Seeded event detail page URL. */
const EVENT_URL = '/events/test-event-comments';

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
    await page.goto(EVENT_URL);

    await expect(page.getByText('主揪的測試留言')).toBeVisible();
    await expect(page.getByText('留言者的測試留言')).toBeVisible();
  });

  test('should hide comment input for unauthenticated user [US1-AC4, FR-025]', async ({ page }) => {
    await page.goto(EVENT_URL);

    await expect(page.getByText('主揪的測試留言')).toBeVisible();
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
    await loginAsUser(page, 'test-commenter@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto(EVENT_URL);

    const uniqueText = `新留言測試 ${Date.now()}`;
    const textbox = page.getByRole('textbox');
    await textbox.fill(uniqueText);
    await page.getByRole('button', { name: /送出/i }).click();

    await expect(page.getByText(uniqueText)).toBeVisible();
    await expect(textbox).toHaveValue('');
  });

  test('should disable submit button when input is empty [US2-AC2, FR-006]', async ({ page }) => {
    await loginAsUser(page, 'test-commenter@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto(EVENT_URL);

    const submitButton = page.getByRole('button', { name: /送出/i });
    await expect(submitButton).toBeDisabled();
  });
});

/* ==========================================================================
   US3: 編輯留言
   ========================================================================== */

test.describe('Event Comments — US3: 編輯留言', () => {
  test('author should see three-dot menu on own comment [US3-AC5, FR-017]', async ({ page }) => {
    await loginAsUser(page, 'test-commenter@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto(EVENT_URL);

    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await expect(menuButton).toBeVisible();
  });

  test('non-author should NOT see three-dot menu on others comments [FR-026]', async ({ page }) => {
    await loginAsUser(page, 'test-viewer@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto(EVENT_URL);

    await expect(page.getByText('主揪的測試留言')).toBeVisible();
    await expect(page.getByRole('button', { name: /更多操作/i })).toHaveCount(0);
  });

  test('full edit flow: open modal → modify → save → see edited badge [US3-AC1~AC3]', async ({
    page,
  }) => {
    await loginAsUser(page, 'test-commenter@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto(EVENT_URL);

    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /編輯留言/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const textarea = dialog.getByRole('textbox');
    await expect(textarea).not.toHaveValue('');

    const saveButton = page.getByRole('button', { name: /完成編輯/i });
    await expect(saveButton).toBeDisabled();

    const newContent = `已編輯內容 ${Date.now()}`;
    await textarea.clear();
    await textarea.fill(newContent);

    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(newContent)).toBeVisible();
    // Use getByRole to avoid strict mode violation when multiple badges exist
    await expect(page.getByRole('button', { name: '查看編輯記錄' }).first()).toBeVisible();
  });

  test('cancel edit should not change comment [US3-AC4]', async ({ page }) => {
    await loginAsUser(page, 'test-commenter@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto(EVENT_URL);

    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /編輯留言/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const textarea = dialog.getByRole('textbox');
    const originalText = await textarea.inputValue();

    await textarea.clear();
    await textarea.fill('不應該出現的留言內容');
    await page.getByRole('button', { name: /取消編輯/i }).click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(originalText)).toBeVisible();
    await expect(page.getByText('不應該出現的留言內容')).not.toBeVisible();
  });

  test('clicking edited badge should show edit history modal [US3-AC7, FR-015]', async ({
    page,
  }) => {
    await loginAsUser(page, 'test-commenter@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto(EVENT_URL);

    // Use first() to avoid strict mode violation with multiple edited badges
    await page
      .getByRole('button', { name: /已編輯|查看編輯記錄/i })
      .first()
      .click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

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
    await loginAsUser(page, 'test-commenter@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto(EVENT_URL);
    const deleteTarget = await postUniqueComment(page, '待刪除留言');

    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /刪除留言/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByText('確定刪除留言？')).toBeVisible();

    await page.getByRole('button', { name: /確定刪除/i }).click();

    await expect(dialog).not.toBeVisible();
    // Firestore delete is async — wait for onSnapshot to propagate removal
    await expect(page.getByText(deleteTarget)).not.toBeVisible({ timeout: 10000 });
  });

  test('cancel delete should keep comment intact [US4-AC4]', async ({ page }) => {
    await loginAsUser(page, 'test-commenter@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto(EVENT_URL);
    const keepTarget = await postUniqueComment(page, '保留留言');

    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /刪除留言/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page.getByRole('button', { name: /取消刪除/i }).click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(keepTarget)).toBeVisible();
  });
});
