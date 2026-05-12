import { expect, test } from '@playwright/test';

import { loginAsUser } from '../../_helpers/e2e-helpers.js';
import { attachAxeReportOnly } from './quality-gate-helpers.js';

const EVENT_URL = '/events/test-event-comments';

test.describe('axe interactive emulator report-only', () => {
  test('authenticated event comment edit dialog attaches axe report', async ({ page }, testInfo) => {
    await loginAsUser(page, 'test-commenter@example.com', 'test-password', {
      waitForText: /活動列表/i,
    });
    await page.goto(EVENT_URL);

    await expect(page.getByText('留言者的測試留言')).toBeVisible();
    await page.getByRole('button', { name: /更多操作/i }).first().click();
    await page.getByRole('menuitem', { name: /編輯留言/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox')).not.toHaveValue('');

    await attachAxeReportOnly(page, testInfo, 'event-comment-edit-dialog');
  });
});
