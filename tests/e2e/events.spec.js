import { test, expect } from '@playwright/test';

test.describe('Events Page E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/events');
  });

  test('should display events and allow filtering', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /活動列表/i })).toBeVisible();
    await page.getByRole('button', { name: /篩選/i }).click();
    await expect(page.getByText('篩選活動')).toBeVisible();

    await page.getByLabel(/選擇縣市/i).selectOption('臺北市');
    await page.getByRole('button', { name: /搜尋/i }).click();

    await expect(page.getByText('篩選活動')).not.toBeVisible();
  });

  test('should show create event button and open modal or show login hint', async ({ page }) => {
    await page.getByRole('button', { name: /新增跑步揪團/i }).click();

    const modalTitle = page.getByText('揪團表單');
    const loginHint = page.getByText('發起活動前請先登入');

    await expect(modalTitle.or(loginHint)).toBeVisible();
  });
});
