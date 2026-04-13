// @ts-check
/**
 * @file E2E test for Weather Page — 完整使用者旅程。
 * @description
 * Tests: initial empty state, county click → weather card, drill-down,
 * back to overview, and URL param sync.
 *
 * Requires a running dev server with a valid CWA API key in .env.
 * Skipped by default in CI (no API key).
 */

import { test, expect } from '@playwright/test';

// Skip if CWA API key is not configured (CI environment)
const hasCwaKey = !!process.env.CWA_API_KEY;
test.skip(!hasCwaKey, 'Requires CWA_API_KEY in .env — skipped in CI');

/** @type {string} 天氣頁面 URL。 */
const WEATHER_URL = '/weather';

test.describe('Weather Page E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(WEATHER_URL);
    // 等待地圖容器載入
    await expect(page.locator('[class*="mapContainer"]')).toBeVisible({ timeout: 10000 });
  });

  test('should show empty state on initial load', async ({ page }) => {
    await expect(page.getByText('請先在地圖上選擇')).toBeVisible();
  });

  test('should display weather after clicking a county on the map', async ({ page }) => {
    // 點擊地圖上的某個縣市 polygon（GeoJSON SVG path，用座標估算位置）
    const mapContainer = page.locator('[class*="mapContainer"]');
    await mapContainer.click({ position: { x: 200, y: 200 } });

    // 等待天氣卡出現（loading → success）
    await expect(page.locator('[class*="temperature"]')).toBeVisible({ timeout: 10000 });
  });

  test('should show BackToOverview button after drill-down', async ({ page }) => {
    const mapContainer = page.locator('[class*="mapContainer"]');
    await mapContainer.click({ position: { x: 200, y: 200 } });

    // BackToOverview 按鈕應出現
    await expect(page.getByText('全台總覽')).toBeVisible({ timeout: 5000 });
  });

  test('should return to overview when clicking BackToOverview', async ({ page }) => {
    const mapContainer = page.locator('[class*="mapContainer"]');
    await mapContainer.click({ position: { x: 200, y: 200 } });
    await expect(page.getByText('全台總覽')).toBeVisible({ timeout: 5000 });

    // 點擊回到總覽
    await page.getByText('全台總覽').click();

    // 應回到空狀態
    await expect(page.getByText('請先在地圖上選擇')).toBeVisible();
  });

  test('should update URL params on location selection', async ({ page }) => {
    const mapContainer = page.locator('[class*="mapContainer"]');
    await mapContainer.click({ position: { x: 200, y: 200 } });
    await expect(page.locator('[class*="temperature"]')).toBeVisible({ timeout: 10000 });

    // URL 應包含 county param
    const url = page.url();
    expect(url).toContain('county=');
  });
});
