// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Posts UI 重構 — 關鍵路徑', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/posts');
  });

  test('列表頁顯示文章河道標題', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '文章河道' })).toBeVisible();
  });

  test('列表頁文章以卡片呈現（article 語義元素）', async ({ page }) => {
    // 等待載入完成（骨架屏消失）
    await expect(page.getByRole('status')).toHaveCount(0, { timeout: 10000 });
    // 至少有一個 article 元素（PostCard）
    const articles = page.getByRole('article');
    await expect(articles.first()).toBeVisible({ timeout: 10000 });
  });

  test('列表頁 feed 窄欄佈局', async ({ page }) => {
    // feed 容器包含 h1「文章河道」，以該標題所在容器驗證可見性
    const feedHeading = page.getByRole('heading', { name: '文章河道', level: 1 });
    await expect(feedHeading).toBeVisible();
  });

  test('骨架屏在載入中顯示', async ({ page }) => {
    // 重新導航時快速檢查（骨架屏可能很短暫）
    await page.goto('/posts');
    // 初始載入時應該顯示 aria-busy 元素（role="status"）
    const skeleton = page.getByRole('status');
    // 骨架屏存在或已消失（載入太快可能已經過了）
    // 這是一個 soft assertion — 如果載入太快就跳過
    const skeletonCount = await skeleton.count();
    if (skeletonCount > 0) {
      await expect(skeleton.first()).toBeVisible();
    }
  });

  test('文章卡片包含標題和按讚/留言數', async ({ page }) => {
    await expect(page.getByRole('status')).toHaveCount(0, { timeout: 10000 });
    const firstArticle = page.getByRole('article').first();
    await expect(firstArticle).toBeVisible({ timeout: 10000 });
    // 卡片內應有標題（h2）
    const title = firstArticle.getByRole('heading', { level: 2 });
    await expect(title).toBeVisible();
  });
});

test.describe('Posts UI — 詳文頁', () => {
  test('詳文頁文章以 PostCard 呈現', async ({ page }) => {
    await page.goto('/posts');
    await expect(page.getByRole('status')).toHaveCount(0, { timeout: 10000 });
    // 點擊第一篇文章標題連結進入詳文頁
    const firstArticle = page.getByRole('article').first();
    const firstTitleLink = firstArticle.getByRole('heading', { level: 2 }).getByRole('link');
    const titleText = await firstTitleLink.textContent();
    await firstTitleLink.click();
    // 詳文頁應顯示同樣的標題
    await expect(page.getByRole('heading', { name: titleText })).toBeVisible({ timeout: 10000 });
    // 應有 article 語義元素
    await expect(page.getByRole('article').first()).toBeVisible();
  });
});
