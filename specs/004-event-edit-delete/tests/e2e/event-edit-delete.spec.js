/**
 * @file E2E Test for Event Edit & Delete Actions
 * @description
 * TDD RED phase — Playwright tests for event edit/delete flows that are NOT implemented yet.
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

/**
 * 登入為指定的測試使用者。
 * @param {import('@playwright/test').Page} page - Playwright page object.
 * @param {string} email - 測試使用者的 email。
 * @param {string} password - 測試使用者的密碼。
 */
async function loginAsUser(page, email, password) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/密碼|password/i).fill(password);
  await page.getByRole('button', { name: /登入|login/i }).click();
  // 等待登入完成 — 檢查導航到 events 頁面或出現使用者元素
  await expect(page.getByText(/活動列表/i)).toBeVisible();
}

test.describe('Event Edit & Delete - User Story 1: 編輯活動', () => {
  test('creator should see three-dot menu on their event card (SC-005)', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-host@example.com', 'test-password');
    await page.goto('/events');

    // Act & Assert — 創建人的活動卡片應有三點按鈕
    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await expect(menuButton).toBeVisible();
  });

  test('non-creator should NOT see three-dot menu (SC-005)', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-participant@example.com', 'test-password');
    await page.goto('/events');

    // Act & Assert — 非創建人不應看到三點按鈕
    // 注意：頁面上可能完全沒有三點按鈕，或者只有自己建立的活動才有
    await expect(page.getByText(/活動列表/i)).toBeVisible();
    // 由於測試帳號不是任何活動的創建人，不應出現 menu
    const menuButtons = page.getByRole('button', { name: /更多操作/i });
    await expect(menuButtons).toHaveCount(0);
  });

  test('clicking three-dot should show edit and delete options (SC-001)', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-host@example.com', 'test-password');
    await page.goto('/events');

    // Act — 點擊三點按鈕
    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();

    // Assert — 下拉選單出現
    await expect(page.getByRole('menuitem', { name: /編輯活動/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /刪除活動/i })).toBeVisible();
  });

  test('edit form should prefill with existing event data (SC-002)', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-host@example.com', 'test-password');
    await page.goto('/events');

    // Act — 打開編輯表單
    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /編輯活動/i }).click();

    // Assert — 表單出現且有預填資料
    const titleInput = page.getByLabel(/活動名稱/i);
    await expect(titleInput).toBeVisible();
    await expect(titleInput).not.toHaveValue('');
  });

  test('"編輯完成" should be disabled initially and enabled after modification (SC-003)', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-host@example.com', 'test-password');
    await page.goto('/events');

    // 打開編輯表單
    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /編輯活動/i }).click();

    // Assert — 初始狀態 disabled
    const submitButton = page.getByRole('button', { name: /編輯完成/i });
    await expect(submitButton).toBeDisabled();

    // Act — 修改標題
    const titleInput = page.getByLabel(/活動名稱/i);
    await titleInput.clear();
    await titleInput.fill('新的活動名稱');

    // Assert — 變為 enabled
    await expect(submitButton).toBeEnabled();
  });

  test('full edit flow: modify title → submit → verify updated (US1)', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-host@example.com', 'test-password');
    await page.goto('/events');

    // 打開編輯表單
    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /編輯活動/i }).click();

    // Act — 修改標題
    const titleInput = page.getByLabel(/活動名稱/i);
    const newTitle = `E2E 測試修改 ${Date.now()}`;
    await titleInput.clear();
    await titleInput.fill(newTitle);

    // 提交
    const submitButton = page.getByRole('button', { name: /編輯完成/i });
    await submitButton.click();

    // Assert — 表單關閉，列表中出現新標題
    await expect(page.getByRole('button', { name: /編輯完成/i })).not.toBeVisible();
    await expect(page.getByText(newTitle)).toBeVisible();
  });

  test('cancel edit should not change event data (US1-AC8)', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-host@example.com', 'test-password');
    await page.goto('/events');

    // 記住原始標題
    const firstEventTitle = await page.locator('[class*="eventTitle"]').first().innerText();

    // 打開編輯表單
    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /編輯活動/i }).click();

    // Act — 修改但取消
    const titleInput = page.getByLabel(/活動名稱/i);
    await titleInput.clear();
    await titleInput.fill('不應該出現的標題');

    const cancelButton = page.getByRole('button', { name: /取消編輯/i });
    await cancelButton.click();

    // Assert — 原始標題保持不變
    await expect(page.getByText(firstEventTitle)).toBeVisible();
    await expect(page.getByText('不應該出現的標題')).not.toBeVisible();
  });
});

test.describe('Event Edit & Delete - User Story 2: 刪除活動', () => {
  test('delete confirmation dialog should appear with proper content (FR-010)', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-host@example.com', 'test-password');
    await page.goto('/events');

    // Act — 點擊刪除
    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /刪除活動/i }).click();

    // Assert — 自訂確認視窗出現
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/確定要刪除活動/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^是$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^否$/i })).toBeVisible();
  });

  test('clicking "否" should close dialog and keep event (US2-AC2)', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-host@example.com', 'test-password');
    await page.goto('/events');

    const firstEventTitle = await page.locator('[class*="eventTitle"]').first().innerText();

    // 打開刪除確認
    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /刪除活動/i }).click();

    // Act — 選擇「否」
    await page.getByRole('button', { name: /^否$/i }).click();

    // Assert — 對話框關閉，活動仍在
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(firstEventTitle)).toBeVisible();
  });

  test('full delete flow: confirm → event removed from list (US2-AC3, SC-004)', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-host@example.com', 'test-password');
    await page.goto('/events');

    const firstEventTitle = await page.locator('[class*="eventTitle"]').first().innerText();

    // 打開刪除確認
    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /刪除活動/i }).click();

    // Act — 選擇「是」確認刪除
    await page.getByRole('button', { name: /^是$/i }).click();

    // Assert — 顯示成功訊息，活動從列表消失
    await expect(page.getByText(/刪除成功/i)).toBeVisible();
    await expect(page.getByText(firstEventTitle)).not.toBeVisible();
  });
});

test.describe('Event Edit & Delete - Edge Cases', () => {
  test('dropdown should close when clicking outside (FR-003)', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test-host@example.com', 'test-password');
    await page.goto('/events');

    // 打開下拉選單
    const menuButton = page.getByRole('button', { name: /更多操作/i }).first();
    await menuButton.click();
    await expect(page.getByRole('menuitem', { name: /編輯活動/i })).toBeVisible();

    // Act — 點擊頁面其他地方
    await page.getByText(/活動列表/i).click();

    // Assert — 選單關閉
    await expect(page.getByRole('menuitem', { name: /編輯活動/i })).not.toBeVisible();
  });

  test('unauthenticated user should NOT see three-dot menu', async ({ page }) => {
    // Arrange — 不登入直接訪問
    await page.goto('/events');

    // Assert — 沒有三點按鈕
    await expect(page.getByText(/活動列表/i)).toBeVisible();
    const menuButtons = page.getByRole('button', { name: /更多操作/i });
    await expect(menuButtons).toHaveCount(0);
  });
});
