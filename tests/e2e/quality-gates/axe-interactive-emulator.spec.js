import { expect, test } from '@playwright/test';

import { loginAsUser } from '../../_helpers/e2e-helpers.js';
import { attachAxeInteractiveBaselineReport } from './quality-gate-helpers.js';

const EVENT_URL = '/events/test-event-comments';
const COMMENTER_EMAIL = 'test-commenter@example.com';
const COMMENTER_PASSWORD = 'test-password';

test.describe('axe interactive emulator baseline', () => {
  /**
   * Signs in as the seeded commenter and opens the event comment surface.
   * @param {import('@playwright/test').Page} page - Playwright page object.
   * @returns {Promise<void>}
   */
  async function loginAndOpenEvent(page) {
    await loginAsUser(page, COMMENTER_EMAIL, COMMENTER_PASSWORD, {
      waitForText: /活動列表/i,
    });
    await page.goto(EVENT_URL);
    await expect(page.getByText('留言者的測試留言')).toBeVisible();
  }

  /**
   * Attaches a scoped interactive axe baseline report.
   * @param {import('@playwright/test').Page} page - Playwright page object.
   * @param {import('@playwright/test').TestInfo} testInfo - Playwright test metadata.
   * @param {string} state - Stable interactive state label.
   * @returns {Promise<void>}
   */
  async function attachInteractiveAxe(page, testInfo, state) {
    await attachAxeInteractiveBaselineReport(page, testInfo, {
      route: EVENT_URL,
      state,
    });
  }

  test('event comment empty submit disabled matches axe baseline', async ({ page }, testInfo) => {
    await loginAndOpenEvent(page);

    const textbox = page.getByRole('textbox');
    await expect(textbox).toBeVisible();
    await expect(textbox).toHaveValue('');
    await expect(page.getByRole('button', { name: /送出/i })).toBeDisabled();

    await attachInteractiveAxe(page, testInfo, 'event-comment-empty-submit-disabled');
  });

  test('event comment create filled input matches axe baseline', async ({ page }, testInfo) => {
    await loginAndOpenEvent(page);

    const textbox = page.getByRole('textbox');
    await textbox.fill(`axe filled comment ${Date.now()}`);
    await expect(textbox).not.toHaveValue('');
    await expect(page.getByRole('button', { name: /送出/i })).toBeEnabled();

    await attachInteractiveAxe(page, testInfo, 'event-comment-create-filled-input');
  });

  test('event comment edit dialog matches axe baseline', async ({ page }, testInfo) => {
    await loginAndOpenEvent(page);

    const seededComment = page.getByRole('article').filter({ hasText: '留言者的測試留言' });
    await seededComment.getByRole('button', { name: /更多操作/i }).click();
    await page.getByRole('menuitem', { name: /編輯留言/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox')).not.toHaveValue('');
    await expect(page.getByRole('button', { name: /完成編輯/i })).toBeDisabled();

    await attachInteractiveAxe(page, testInfo, 'event-comment-edit-dialog');
  });

  test('event comment delete confirm dialog matches axe baseline', async ({ page }, testInfo) => {
    await loginAndOpenEvent(page);

    const uniqueText = `axe delete candidate ${Date.now()}`;
    const textbox = page.getByRole('textbox');
    await textbox.fill(uniqueText);
    await page.getByRole('button', { name: /送出/i }).click();
    await expect(page.getByText(uniqueText)).toBeVisible();

    const throwawayComment = page.getByRole('article').filter({ hasText: uniqueText });
    await throwawayComment.getByRole('button', { name: /更多操作/i }).click();
    await page.getByRole('menuitem', { name: /刪除留言/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByText('確定刪除留言？')).toBeVisible();
    await expect(page.getByRole('button', { name: /確定刪除/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /取消刪除/i })).toBeVisible();

    /** @type {unknown} */
    let scanError;
    /** @type {unknown} */
    let cleanupError;

    try {
      await attachInteractiveAxe(page, testInfo, 'event-comment-delete-confirm-dialog');
    } catch (error) {
      scanError = error;
    }

    try {
      await dialog.getByRole('button', { name: /確定刪除/i }).click();
      await expect(throwawayComment).toHaveCount(0);
    } catch (error) {
      cleanupError = error;
    }

    if (scanError) {
      throw scanError;
    }

    if (cleanupError) {
      throw cleanupError;
    }
  });
});
