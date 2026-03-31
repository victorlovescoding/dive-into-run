import { test, expect } from '@playwright/test';

test.describe('Event Filtering Feature', () => {
  test.beforeEach(async ({ page }) => {
    // 假設本地 server 跑在 3000
    await page.goto('http://localhost:3000/events');
  });

  test('應該能打開篩選器並進行縣市區域連動搜尋 (US1, US4)', async ({ page }) => {
    // 1. 打開篩選器
    await page.getByRole('button', { name: '篩選活動' }).click();

    // 驗證篩選器已開啟
    const filterModal = page.locator('div[role="dialog"]');
    await expect(filterModal).toBeVisible();

    // 2. 選擇城市 (桃園市)
    const citySelect = page.getByRole('combobox', { name: '選擇縣市' });
    await citySelect.selectOption('桃園市');

    // 3. 驗證區域連動：等待龜山區選項出現並選取
    const districtSelect = page.getByRole('combobox', { name: '選擇區域' });
    await districtSelect.selectOption('龜山區');

    // 4. 點擊搜尋
    await page.getByRole('button', { name: '搜尋' }).click();

    // 5. 驗證篩選器自動關閉 (UI-004)
    await expect(filterModal).toBeHidden();
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

  test('點擊搜尋結果應導向詳情頁 (FR-007)', async ({ page }) => {
    // 1. 執行一個簡單搜尋，確保有結果 (假設預設列表有活動，或執行寬鬆搜尋)
    await page.getByRole('button', { name: '篩選活動' }).click();
    await page.getByRole('button', { name: '搜尋' }).click();

    // 2. 等待列表載入 (假設至少有一個結果)
    const firstEventCard = page.locator('a[href^="/events/"]').first();
    await expect(firstEventCard).toBeVisible();

    // 取得該卡片的連結
    const href = await firstEventCard.getAttribute('href');

    // 3. 點擊卡片
    await firstEventCard.click();

    // 4. 驗證網址是否包含 event ID
    await expect(page).toHaveURL(new RegExp(href));

    // 5. 驗證是否進入詳情頁 (檢查是否有詳情頁特有的元素，例如「回到活動列表」)
    await expect(page.getByText('回到活動列表')).toBeVisible();

    // 6. 驗證配速是否正確顯示 (格式應為 MM:SS /km)
    // 我們尋找包含配速文字的具體 div
    const paceText = page
      .locator('div')
      .filter({ hasText: /^配速：/ })
      .last();
    await expect(paceText).toContainText(/\d+:\d+ \/km/);
  });
});
