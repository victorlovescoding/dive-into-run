import { test, expect } from '@playwright/test';

test.describe('Events Page E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/events');
  });

  test('should display events and allow filtering', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /所有活動/i })).toBeVisible();
    await page.getByRole('button', { name: /篩選/i }).click();
    await expect(page.getByText('篩選活動')).toBeVisible();

    await page.getByLabel(/縣市/i).selectOption('臺北市');
    await page.getByRole('button', { name: /確定/i }).click();

    await expect(page.getByText('篩選活動')).not.toBeVisible();
  });

  test('should show create event button and open modal', async ({ page }) => {
    await page.getByRole('button', { name: /發起揪跑/i }).click();
    await expect(page.getByText('發起揪跑活動')).toBeVisible();
    await expect(page.getByLabel(/活動名稱/i)).toBeVisible();
  });
});
