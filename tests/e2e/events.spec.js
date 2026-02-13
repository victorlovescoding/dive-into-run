import { test, expect } from '@playwright/test';

test.describe('Events Page', () => {
  test('should load the events page and show title', async ({ page }) => {
    // 1. Visit the events page
    await page.goto('/events');

    // 2. Verify page title matches UI "這是揪團跑步頁面"
    await expect(page.getByRole('heading', { name: '這是揪團跑步頁面' })).toBeVisible();

    // 3. Verify event list section is present
    await expect(page.getByText('正在載入活動')).toBeVisible(); 
    // Note: Depends on whether backend returns data or stays loading. 
    // We check for the loading state first to ensure page structure loads.
  });
});
