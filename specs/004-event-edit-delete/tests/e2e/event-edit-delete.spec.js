/**
 * @file E2E Test for Event Edit & Delete Actions
 * @description
 * Playwright tests for event edit/delete flows.
 * Covers full user journeys for:
 * - User Story 1: 活動創建人編輯自己的活動
 * - User Story 2: 活動創建人刪除自己的活動
 *
 * Rules:
 * 1. Use Playwright for E2E tests.
 * 2. Use `page.getByRole` / `page.getByText` for locators — no CSS selectors.
 * 3. STRICTLY FORBIDDEN: `page.waitForTimeout()` — use Playwright auto-wait.
 * 4. STRICT JSDoc is required.
 * 5. NO `console.log`.
 */

// @ts-check
import { test, expect } from '@playwright/test';
import { loginAsUser } from '../../../test-utils/e2e-helpers.js';

// Run all tests in this file serially to avoid Firestore state conflicts
test.describe.configure({ mode: 'serial' });

/**
 * Finds the event card wrapper that contains the given title and a menu button.
 * Ensures title and menu refer to the same event card.
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @param {string} title - Event title text.
 * @returns {import('@playwright/test').Locator} The scoped card locator.
 */
function getEventCard(page, title) {
  return page
    .locator('div')
    .filter({ has: page.getByText(title, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: /更多操作/i }) })
    .first();
}

test.describe('Event Edit & Delete - User Story 1: 編輯活動', () => {
  test('creator should see three-dot menu on their event card (SC-005)', async ({ page }) => {
    await loginAsUser(page, 'test-host@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto('/events');

    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await expect(menuButton).toBeVisible();
  });

  test('non-creator should NOT see three-dot menu (SC-005)', async ({ page }) => {
    await loginAsUser(page, 'test-participant@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto('/events');

    await expect(page.getByText(/活動列表/i)).toBeVisible();
    const menuButtons = page.getByRole('button', { name: /更多操作/i });
    await expect(menuButtons).toHaveCount(0);
  });

  test('clicking three-dot should show edit and delete options (SC-001)', async ({ page }) => {
    await loginAsUser(page, 'test-host@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto('/events');

    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();

    await expect(page.getByRole('menuitem', { name: /編輯活動/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /刪除活動/i })).toBeVisible();
  });

  test('edit form should prefill with existing event data (SC-002)', async ({ page }) => {
    await loginAsUser(page, 'test-host@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto('/events');

    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /編輯活動/i }).click();

    const titleInput = page.getByLabel(/活動名稱/i);
    await expect(titleInput).toBeVisible();
    await expect(titleInput).not.toHaveValue('');
  });

  test('"編輯完成" should be disabled initially and enabled after modification (SC-003)', async ({
    page,
  }) => {
    await loginAsUser(page, 'test-host@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto('/events');

    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /編輯活動/i }).click();

    const submitButton = page.getByRole('button', { name: /編輯完成/i });
    await expect(submitButton).toBeDisabled();

    const titleInput = page.getByLabel(/活動名稱/i);
    await titleInput.clear();
    await titleInput.fill('新的活動名稱');

    await expect(submitButton).toBeEnabled();
  });

  test('full edit flow: modify title → submit → verify updated (US1)', async ({ page }) => {
    await loginAsUser(page, 'test-host@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto('/events');

    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /編輯活動/i }).click();

    const titleInput = page.getByLabel(/活動名稱/i);
    const newTitle = `E2E 測試修改 ${Date.now()}`;
    await titleInput.clear();
    await titleInput.fill(newTitle);

    const submitButton = page.getByRole('button', { name: /編輯完成/i });
    await submitButton.click();

    await expect(page.getByRole('button', { name: /編輯完成/i })).not.toBeVisible();
    await expect(page.getByText(newTitle)).toBeVisible();
  });

  test('cancel edit should not change event data (US1-AC8)', async ({ page }) => {
    await loginAsUser(page, 'test-host@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto('/events');

    const firstEventTitle = await page
      .getByRole('link', { name: /測試活動/ })
      .first()
      .innerText();

    const card = getEventCard(page, firstEventTitle);
    const menuButton = card.getByRole('button', { name: /更多操作/i });
    await menuButton.click();
    await page.getByRole('menuitem', { name: /編輯活動/i }).click();

    const titleInput = page.getByLabel(/活動名稱/i);
    await titleInput.clear();
    await titleInput.fill('不應該出現的標題');

    const cancelButton = page.getByRole('button', { name: /取消編輯/i });
    await cancelButton.click();

    await expect(page.getByText(firstEventTitle)).toBeVisible();
    await expect(page.getByText('不應該出現的標題')).not.toBeVisible();
  });
});

test.describe('Event Edit & Delete - User Story 2: 刪除活動', () => {
  test('delete confirmation dialog should appear with proper content (FR-010)', async ({
    page,
  }) => {
    await loginAsUser(page, 'test-host@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto('/events');

    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /刪除活動/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/確定要刪除活動/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /是，確認刪除/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /否，取消/i })).toBeVisible();
  });

  test('clicking "否" should close dialog and keep event (US2-AC2)', async ({ page }) => {
    await loginAsUser(page, 'test-host@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto('/events');

    const firstEventTitle = await page
      .getByRole('link', { name: /測試活動/ })
      .first()
      .innerText();

    const card = getEventCard(page, firstEventTitle);
    await card.getByRole('button', { name: /更多操作/i }).click();
    await page.getByRole('menuitem', { name: /刪除活動/i }).click();

    await page.getByRole('button', { name: /否，取消/i }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(firstEventTitle)).toBeVisible();
  });

  test('full delete flow: confirm → event removed from list (US2-AC3, SC-004)', async ({
    page,
  }) => {
    await loginAsUser(page, 'test-host@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto('/events');

    // Scope title + menu to the SAME event card to avoid mismatch
    const eventLink = page.getByRole('link', { name: /測試活動/ }).first();
    const firstEventTitle = await eventLink.innerText();
    const card = getEventCard(page, firstEventTitle);

    await card.getByRole('button', { name: /更多操作/i }).click();
    await page.getByRole('menuitem', { name: /刪除活動/i }).click();

    await page.getByRole('button', { name: /是，確認刪除/i }).click();

    await expect(page.getByText(/活動已刪除/i)).toBeVisible();
    await expect(page.getByText(firstEventTitle)).not.toBeVisible();
  });
});

test.describe('Event Edit & Delete - Edge Cases', () => {
  test('dropdown should close when clicking outside (FR-003)', async ({ page }) => {
    await loginAsUser(page, 'test-host@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto('/events');

    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await expect(page.getByRole('menuitem', { name: /編輯活動/i })).toBeVisible();

    await page.getByText(/活動列表/i).click();

    await expect(page.getByRole('menuitem', { name: /編輯活動/i })).not.toBeVisible();
  });

  test('unauthenticated user should NOT see three-dot menu', async ({ page }) => {
    await page.goto('/events');

    await expect(page.getByText(/活動列表/i)).toBeVisible();
    const menuButtons = page.getByRole('button', { name: /更多操作/i });
    await expect(menuButtons).toHaveCount(0);
  });
});
