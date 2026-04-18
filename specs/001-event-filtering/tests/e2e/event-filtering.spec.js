import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Event Filtering Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/events');
  });

  test('應該能打開篩選器並進行縣市區域連動搜尋 (US1, US4)', async ({ page }) => {
    // 1. 打開篩選器
    await page.getByRole('button', { name: '篩選活動' }).click();

    // 驗證篩選器已開啟
    const filterModal = page.getByRole('dialog', { name: '篩選活動詳情' });
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

  test('清除按鈕應該重置所有篩選欄位 (UI-003)', async ({ page }) => {
    await page.getByRole('button', { name: '篩選活動' }).click();

    // 填寫最小距離
    await page.getByLabel('最小跑步距離').fill('10');

    // 點擊清除
    await page.getByRole('button', { name: '清除' }).click();

    // 驗證數字欄位被清空
    await expect(page.getByLabel('最小跑步距離')).toHaveValue('');

    // 驗證名額 checkbox 被重置為未勾選
    const checkbox = page.getByLabel('只顯示還有名額的活動');
    await expect(checkbox).not.toBeChecked();
  });

  test('當搜尋無結果時應顯示提示 (UI-007)', async ({ page }) => {
    await page.getByRole('button', { name: '篩選活動' }).click();

    // 輸入一個不可能的距離
    await page.getByLabel('最小跑步距離').fill('9999');

    await page.getByRole('button', { name: '搜尋' }).click();

    // 驗證出現空狀態文字
    await expect(page.getByText('沒有符合條件的活動')).toBeVisible();
  });

  test('點擊搜尋結果應導向詳情頁 (FR-007)', async ({ page }) => {
    // 1. 執行一個簡單搜尋，確保有結果
    await page.getByRole('button', { name: '篩選活動' }).click();
    await page.getByRole('button', { name: '搜尋' }).click();

    // 2. 等待列表載入，找到第一個活動標題連結
    const firstEventLink = page.getByRole('link', { name: /E2E 篩選/ }).first();
    await expect(firstEventLink).toBeVisible();

    // 取得該連結的 href
    const href = await firstEventLink.getAttribute('href');

    // 3. 點擊連結
    await firstEventLink.click();

    // 4. 驗證網址是否包含 event ID
    await expect(page).toHaveURL(new RegExp(href));

    // 5. 驗證是否進入詳情頁
    await expect(page.getByText('← 回到活動列表')).toBeVisible();

    // 6. 驗證配速是否正確顯示 (格式應為 MM:SS /km)
    await expect(page.getByText(/配速：\d{1,2}:\d{2} \/km/)).toBeVisible();
  });
});
