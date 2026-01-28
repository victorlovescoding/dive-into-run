import { test, expect } from '@playwright/test';

test.describe('Event Filtering Feature', () => {
  
  test.beforeEach(async ({ page }) => {
    // 假設本地 server 跑在 3000
    await page.goto('http://localhost:3000/events');
  });

  test('應該能打開篩選器並進行搜尋 (US1)', async ({ page }) => {
    // 1. 打開篩選器
    await page.getByRole('button', { name: '篩選活動' }).click();
    
    // 驗證篩選器已開啟
    const filterModal = page.locator('div[role="dialog"]');
    await expect(filterModal).toBeVisible();

    // 2. 輸入條件 (地點：臺北市)
    // 根據 page.js，這是一個 select
    await page.locator('select').first().selectOption('臺北市');

    // 3. 點擊搜尋
    await page.getByRole('button', { name: '搜尋' }).click();

    // 4. 驗證篩選器自動關閉 (UI-004)
    await expect(filterModal).toBeHidden();

    // 5. 驗證列表更新 (需視實際資料而定，這裡先檢查列表容器存在)
    // 根據 events.module.css，卡片 class 是 .eventCard
    // await expect(page.locator('.eventCard').first()).toBeVisible();
  });

  test('清除按鈕應該重置欄位但保留名額勾選 (UI-003)', async ({ page }) => {
    await page.getByRole('button', { name: '篩選活動' }).click();
    
    // 填寫一些資料
    await page.locator('input[type="number"]').first().fill('10');
    
    // 點擊清除
    await page.getByRole('button', { name: '清除' }).click();
    
    // 驗證數字欄位被清空
    await expect(page.locator('input[type="number"]').first()).toHaveValue('');
    
    // 驗證名額 checkbox 還是勾選的 (預設)
    // 注意：需確認 switch 的實作方式，這裡是假設 input[type="checkbox"]
    const checkbox = page.locator('input[type="checkbox"]');
    await expect(checkbox).toBeChecked();
  });

  test('當搜尋無結果時應顯示提示 (UI-007)', async ({ page }) => {
    await page.getByRole('button', { name: '篩選活動' }).click();
    
    // 輸入一個不可能的距離
    await page.locator('input[placeholder="最小距離"]').fill('9999');
    
    await page.getByRole('button', { name: '搜尋' }).click();
    
    // 驗證出現空狀態文字
    await expect(page.getByText('沒有符合條件的活動')).toBeVisible();
  });
});
