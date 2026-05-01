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

/**
 * Clicks a county on the Leaflet map by finding the map container and
 * dispatching a click on a GeoJSON SVG path element.
 * Leaflet renders polygons as SVG `<path>` elements inside the map container.
 * We use page.evaluate to find and click one that's large enough to be a
 * mainland county (avoids tiny island paths that may not trigger handlers).
 * @param {import('@playwright/test').Page} page - Playwright page.
 */
async function clickCountyOnMap(page) {
  const map = page.getByRole('application', { name: '台灣互動地圖' });
  // Click near the center of the map container — Taiwan's mainland
  // is rendered by Leaflet's fitBounds roughly at center.
  const box = await map.boundingBox();
  if (!box) throw new Error('Map container not found');
  // Click slightly right-of-center and mid-height to hit mainland Taiwan
  await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.4);
}

test.describe('Weather Page E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(WEATHER_URL);
    // Wait for map container via its accessible role
    await expect(page.getByRole('application', { name: '台灣互動地圖' })).toBeVisible({
      timeout: 10000,
    });
    // Wait for Leaflet SVG paths to be rendered (GeoJSON polygons)
    await page.waitForSelector('path.leaflet-interactive', { state: 'visible', timeout: 10000 });
  });

  test('should show empty state on initial load', async ({ page }) => {
    await expect(page.getByText('請先在地圖上選擇')).toBeVisible();
  });

  test('should display weather after clicking a county on the map', async ({ page }) => {
    await clickCountyOnMap(page);

    // Wait for weather card to appear (loading → success)
    await expect(page.getByText(/\d+°/).first()).toBeVisible({ timeout: 10000 });
  });

  test('should show BackToOverview button after drill-down', async ({ page }) => {
    await clickCountyOnMap(page);

    // BackToOverview button should appear
    await expect(page.getByText('全台總覽')).toBeVisible({ timeout: 5000 });
  });

  test('should return to overview when clicking BackToOverview', async ({ page }) => {
    await clickCountyOnMap(page);
    await expect(page.getByText('全台總覽')).toBeVisible({ timeout: 5000 });

    // Click back to overview
    await page.getByText('全台總覽').click();

    // Should return to empty state
    await expect(page.getByText('請先在地圖上選擇')).toBeVisible();
  });

  test('should update URL params on location selection', async ({ page }) => {
    await clickCountyOnMap(page);
    await expect(page.getByText(/\d+°/).first()).toBeVisible({ timeout: 10000 });

    // URL should contain county param
    const url = page.url();
    expect(url).toContain('county=');
  });
});
