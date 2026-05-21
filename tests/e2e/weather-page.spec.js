// @ts-check
/**
 * @file E2E test for Weather Page — 完整使用者旅程。
 * @description
 * Tests: initial empty state, county click → weather card, drill-down,
 * back to overview, URL param sync, map controls, tooltip, selected polygon,
 * and responsive weather sheet behavior.
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
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const TABLET_VIEWPORT = { width: 834, height: 1112 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const TAIPEI_CITY_COUNTY_PARAM = '63000';
const FORBIDDEN_MAP_NETWORK_PATTERNS = [
  /\bd3(?:[.@/]|$)/i,
  /tile\.open(?:street)map\.org/i,
  /(?:^|[./-])tile(?:s)?[./-]/i,
  /car(?:to)cdn|stamen|map(?:box|tiler)/i,
];
const forbiddenMapRequestsByPage = new WeakMap();

/**
 * @typedef {object} PathGeometry
 * @property {string} d - SVG path data.
 * @property {number} x - Bounding box x position.
 * @property {number} y - Bounding box y position.
 * @property {number} width - Bounding box width.
 * @property {number} height - Bounding box height.
 */
/**
 * @typedef {object} ScreenPoint
 * @property {number} x - Screen x coordinate.
 * @property {number} y - Screen y coordinate.
 */

/**
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {import('@playwright/test').Locator} Weather map locator.
 */
function weatherMap(page) {
  return page.getByRole('application', { name: '台灣互動地圖' });
}

/**
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {import('@playwright/test').Locator} Real Leaflet SVG path locator.
 */
function leafletPaths(page) {
  return weatherMap(page).locator('path.leaflet-interactive');
}

/**
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @param {string} name - Control accessible name.
 * @returns {import('@playwright/test').Locator} Map control button.
 */
function mapControl(page, name) {
  return page.getByRole('button', { name });
}

/**
 * Records network requests that would indicate a D3/tile-provider map engine.
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {string[]} Mutable list of forbidden URLs observed by the page.
 */
function watchForbiddenMapRequests(page) {
  const forbiddenUrls = [];
  forbiddenMapRequestsByPage.set(page, forbiddenUrls);
  page.on('request', (request) => {
    const url = request.url();
    if (FORBIDDEN_MAP_NETWORK_PATTERNS.some((pattern) => pattern.test(url))) {
      forbiddenUrls.push(url);
    }
  });
  return forbiddenUrls;
}

/**
 * @param {string} locationName - Weather card location name.
 * @param {number} currentTemp - Current temperature.
 * @returns {{ ok: true, data: object }} Weather API response fixture.
 */
function createWeatherPayload(locationName, currentTemp) {
  return {
    ok: true,
    data: {
      locationName,
      locationNameShort: locationName,
      today: {
        currentTemp,
        weatherDesc: '晴時多雲',
        weatherCode: '02',
        morningTemp: currentTemp + 1,
        eveningTemp: currentTemp - 3,
        rainProb: 10,
        humidity: 72,
        uv: null,
        aqi: null,
      },
      tomorrow: {
        weatherDesc: '多雲',
        weatherCode: '04',
        morningTemp: currentTemp + 1,
        eveningTemp: currentTemp - 2,
        rainProb: 20,
        humidity: 78,
        uv: null,
      },
    },
  };
}

/**
 * Keeps the E2E focused on browser behavior while preserving the credential gate.
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {Promise<void>}
 */
async function mockWeatherApi(page) {
  await page.route('**/api/weather?**', async (route) => {
    const url = new URL(route.request().url());
    const county = url.searchParams.get('county') ?? '台北市';
    const township = url.searchParams.get('township');
    const normalizedCounty = county.replace(/台/g, '臺');
    const normalizedTownship = township?.replace(/台/g, '臺') ?? null;
    const locationName = normalizedTownship
      ? `${normalizedCounty} · ${normalizedTownship}`
      : normalizedCounty;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createWeatherPayload(locationName, normalizedTownship ? 27 : 28)),
    });
  });
}

/**
 * Prevents the Next dev overlay portal from intercepting the next mobile click
 * while preserving real pointer input for the app UI.
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {Promise<void>}
 */
async function neutralizeNextDevOverlayPointerInterceptionForMobileClick(page) {
  await page.addStyleTag({
    content: 'nextjs-portal, nextjs-portal * { pointer-events: none !important; }',
  });
}

/**
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {Promise<void>}
 */
async function expectLeafletPathsRendered(page) {
  await expect.poll(async () => {
    const paths = leafletPaths(page);
    const pathCount = await paths.count();
    for (let index = 0; index < pathCount; index += 1) {
      const box = await paths.nth(index).boundingBox();
      if (box && box.width > 0 && box.height > 0) return true;
    }
    return false;
  }).toBe(true);
}

/**
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @param {{ width: number, height: number }} [viewport] - Optional viewport.
 * @returns {Promise<string[]>} Forbidden map network requests observed.
 */
async function gotoWeatherPage(page, viewport) {
  if (viewport) {
    await page.setViewportSize(viewport);
  }
  await mockWeatherApi(page);
  const forbiddenUrls = watchForbiddenMapRequests(page);
  await page.goto(WEATHER_URL);
  await expect(weatherMap(page)).toBeVisible({ timeout: 10000 });
  await expectLeafletPathsRendered(page);
  return forbiddenUrls;
}

/**
 * Chooses a real rendered Leaflet polygon large enough for stable interaction.
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {Promise<import('@playwright/test').Locator>} Largest visible path.
 */
async function largestVisibleLeafletPath(page) {
  const paths = leafletPaths(page);
  await expectLeafletPathsRendered(page);

  const pathCount = await paths.count();
  let bestIndex = 0;
  let bestArea = 0;

  for (let index = 0; index < pathCount; index += 1) {
    const box = await paths.nth(index).boundingBox();
    const area = box ? box.width * box.height : 0;
    if (area > bestArea) {
      bestArea = area;
      bestIndex = index;
    }
  }

  return paths.nth(bestIndex);
}

/**
 * Finds a rendered screen point that is actually inside the SVG path fill.
 * @param {import('@playwright/test').Locator} path - Leaflet path locator.
 * @returns {Promise<ScreenPoint>} Screen point suitable for mouse input.
 */
async function interactivePointForPath(path) {
  return path.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      throw new Error('Leaflet path has no browser-hit-testable bounds');
    }

    const { documentElement } = element.ownerDocument;
    const xSteps = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82];
    const ySteps = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82];
    const isInViewport = (x, y) => (
      x >= 0 &&
      y >= 0 &&
      x <= documentElement.clientWidth &&
      y <= documentElement.clientHeight
    );
    const isBrowserHit = (x, y) => element.ownerDocument.elementFromPoint(x, y) === element;

    if (!(element instanceof SVGPathElement) || !element.ownerSVGElement) {
      for (const yStep of ySteps) {
        for (const xStep of xSteps) {
          const x = rect.left + rect.width * xStep;
          const y = rect.top + rect.height * yStep;
          if (isInViewport(x, y) && isBrowserHit(x, y)) return { x, y };
        }
      }
      throw new Error('No browser-hit-testable point was found for Leaflet path');
    }

    const screenMatrix = element.getScreenCTM();
    if (!screenMatrix) {
      throw new Error('Leaflet path has no screen transform');
    }

    const localPoint = element.ownerSVGElement.createSVGPoint();
    const inverseScreenMatrix = screenMatrix.inverse();

    for (const yStep of ySteps) {
      for (const xStep of xSteps) {
        const x = rect.left + rect.width * xStep;
        const y = rect.top + rect.height * yStep;
        if (!isInViewport(x, y) || !isBrowserHit(x, y)) continue;

        localPoint.x = x;
        localPoint.y = y;
        const svgPoint = localPoint.matrixTransform(inverseScreenMatrix);
        if (element.isPointInFill(svgPoint) || element.isPointInStroke(svgPoint)) {
          return { x, y };
        }
      }
    }

    throw new Error('No browser-hit-testable point was found for Leaflet path');
  });
}

/**
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @param {import('@playwright/test').Locator} path - Leaflet path locator.
 * @returns {Promise<void>}
 */
async function clickLeafletPath(page, path) {
  const point = await interactivePointForPath(path);
  await page.mouse.click(point.x, point.y);
}

/**
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @param {import('@playwright/test').Locator} path - Leaflet path locator.
 * @returns {Promise<void>}
 */
async function hoverLeafletPath(page, path) {
  const point = await interactivePointForPath(path);
  await page.mouse.move(point.x, point.y);
}

/**
 * Finds a real Leaflet path by the hover tooltip text it produces.
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @param {string} tooltipText - Expected tooltip substring.
 * @returns {Promise<import('@playwright/test').Locator>} Matching path.
 */
async function leafletPathByTooltipText(page, tooltipText) {
  const paths = leafletPaths(page);
  await expectLeafletPathsRendered(page);

  const pathCount = await paths.count();
  for (let index = 0; index < pathCount; index += 1) {
    const path = paths.nth(index);
    const box = await path.boundingBox();
    if (!box || box.width === 0 || box.height === 0) continue;

    let didHover = true;
    try {
      await hoverLeafletPath(page, path);
    } catch {
      didHover = false;
    }
    if (!didHover) continue;

    const text = await page.getByRole('tooltip').textContent({ timeout: 500 }).catch(() => '');
    if (text?.includes(tooltipText)) {
      return path;
    }
  }

  throw new Error(`Leaflet path with tooltip "${tooltipText}" was not found`);
}

/**
 * @param {import('@playwright/test').Locator} path - Leaflet path locator.
 * @returns {Promise<PathGeometry>} Geometry used to prove map movement.
 */
async function pathGeometry(path) {
  const box = await path.boundingBox();
  if (!box) throw new Error('Leaflet path has no rendered bounds');

  return {
    d: (await path.getAttribute('d')) ?? '',
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}

/**
 * @param {PathGeometry} before - Geometry before interaction.
 * @param {PathGeometry} after - Geometry after interaction.
 * @returns {boolean} Whether geometry changed enough to prove map action.
 */
function hasGeometryChanged(before, after) {
  return before.d !== after.d ||
    before.x !== after.x ||
    before.y !== after.y ||
    before.width !== after.width ||
    before.height !== after.height;
}

/**
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @param {() => Promise<void>} action - Map action expected to move geometry.
 * @returns {Promise<void>}
 */
async function expectMapGeometryToChangeAfter(page, action) {
  const path = await largestVisibleLeafletPath(page);
  const before = await pathGeometry(path);

  await action();

  await expect.poll(async () => {
    const after = await pathGeometry(path);
    return hasGeometryChanged(before, after);
  }).toBe(true);
}

/**
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {Promise<void>}
 */
async function expectTaipeiCountyUrlState(page) {
  await expect.poll(async () => new URL(page.url()).searchParams.get('county'))
    .toBe(TAIPEI_CITY_COUNTY_PARAM);
}

/**
 * Clicks a real county SVG path and waits for the weather journey state.
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {Promise<void>}
 */
async function selectCountyOnMap(page) {
  const countyPath = await leafletPathByTooltipText(page, '台北市');
  await clickLeafletPath(page, countyPath);
  await expectTaipeiCountyUrlState(page);
  await expect(page.getByRole('button', { name: /全台總覽/ })).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('current-temperature')).toBeVisible({ timeout: 10000 });
}

/**
 * Clicks a real township SVG path after county drill-down.
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {Promise<void>}
 */
async function selectTownshipOnMap(page) {
  const townshipPath = await leafletPathByTooltipText(page, '台北市 ·');
  await clickLeafletPath(page, townshipPath);
  await expect(page).toHaveURL(/township=/, { timeout: 10000 });
}

/**
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {Promise<void>}
 */
async function expectSelectedPolygonVisible(page) {
  const selectedPath = weatherMap(page)
    .locator('path.leaflet-interactive[fill="#5B8DB8"], path.leaflet-interactive[fill="#5b8db8"]')
    .first();
  await expect(selectedPath).toBeVisible({ timeout: 10000 });

  await expect.poll(async () => {
    const box = await selectedPath.boundingBox();
    const fill = await selectedPath.getAttribute('fill');
    return Boolean(fill && box && box.width > 0 && box.height > 0);
  }).toBe(true);
}

/**
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {Promise<void>}
 */
async function expectNoTaiwanMdBranding(page) {
  await expect(page.getByText(/22 COUNTIES|台灣 TAIWAN|臺灣 TAIWAN/i)).toHaveCount(0);
}

/**
 * @param {string[]} forbiddenUrls - Forbidden URLs captured during a test.
 * @returns {void}
 */
function expectNoForbiddenMapRequests(forbiddenUrls) {
  expect(forbiddenUrls).toEqual([]);
}

/**
 * @param {import('@playwright/test').Locator} first - First locator.
 * @param {import('@playwright/test').Locator} second - Second locator.
 * @returns {Promise<boolean>} Whether two rendered boxes overlap.
 */
async function boxesOverlap(first, second) {
  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  if (!firstBox || !secondBox) return false;

  return firstBox.x < secondBox.x + secondBox.width &&
    firstBox.x + firstBox.width > secondBox.x &&
    firstBox.y < secondBox.y + secondBox.height &&
    firstBox.y + firstBox.height > secondBox.y;
}

test.describe('Weather Page E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test('should show empty state on initial load', async ({ page }) => {
    const forbiddenUrls = await gotoWeatherPage(page);

    await expect(page.getByText('請先在地圖上選擇')).toBeVisible();
    await expect(weatherMap(page)).toBeVisible();
    await expectNoTaiwanMdBranding(page);
    expectNoForbiddenMapRequests(forbiddenUrls);
  });

  test('should display weather after clicking a county on the map', async ({ page }) => {
    const forbiddenUrls = await gotoWeatherPage(page);
    await selectCountyOnMap(page);

    await expect(page.getByTestId('current-temperature')).toBeVisible({ timeout: 10000 });
    expectNoForbiddenMapRequests(forbiddenUrls);
  });

  test('should show BackToOverview button after drill-down', async ({ page }) => {
    const forbiddenUrls = await gotoWeatherPage(page);
    await selectCountyOnMap(page);

    await expect(page.getByText('全台總覽')).toBeVisible({ timeout: 5000 });
    expectNoForbiddenMapRequests(forbiddenUrls);
  });

  test('should return to overview when clicking BackToOverview', async ({ page }) => {
    const forbiddenUrls = await gotoWeatherPage(page);
    await selectCountyOnMap(page);
    await expect(page.getByText('全台總覽')).toBeVisible({ timeout: 5000 });

    await page.getByText('全台總覽').click();

    await expect(page.getByText('請先在地圖上選擇')).toBeVisible();
    await expectLeafletPathsRendered(page);
    expectNoForbiddenMapRequests(forbiddenUrls);
  });

  test('should update URL params on location selection', async ({ page }) => {
    const forbiddenUrls = await gotoWeatherPage(page);
    await selectCountyOnMap(page);
    await expect(page.getByTestId('current-temperature')).toBeVisible({ timeout: 10000 });

    await expectTaipeiCountyUrlState(page);
    expectNoForbiddenMapRequests(forbiddenUrls);
  });

  test('should support custom map controls and desktop hover tooltip at 1440x900', async ({
    page,
  }) => {
    const forbiddenUrls = await gotoWeatherPage(page, DESKTOP_VIEWPORT);

    await expect(mapControl(page, '放大地圖')).toBeEnabled();
    await expect(mapControl(page, '縮小地圖')).toBeEnabled();
    await expect(mapControl(page, '重設地圖範圍')).toBeEnabled();

    await expectMapGeometryToChangeAfter(page, async () => {
      await mapControl(page, '放大地圖').click();
    });
    await expectMapGeometryToChangeAfter(page, async () => {
      await mapControl(page, '重設地圖範圍').click();
    });
    await expectMapGeometryToChangeAfter(page, async () => {
      await mapControl(page, '縮小地圖').click();
    });

    const countyPath = await leafletPathByTooltipText(page, '台北市');
    await hoverLeafletPath(page, countyPath);

    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('台北市');
    await expectNoTaiwanMdBranding(page);
    expectNoForbiddenMapRequests(forbiddenUrls);
  });

  test('should keep the selected polygon visible after map selection', async ({ page }) => {
    const forbiddenUrls = await gotoWeatherPage(page, DESKTOP_VIEWPORT);

    await selectCountyOnMap(page);
    await expect(leafletPaths(page).first()).toBeVisible();
    await selectTownshipOnMap(page);

    await expectSelectedPolygonVisible(page);
    expectNoForbiddenMapRequests(forbiddenUrls);
  });

  test('should keep tablet map and weather content usable at 834x1112', async ({ page }) => {
    const forbiddenUrls = await gotoWeatherPage(page, TABLET_VIEWPORT);

    await selectCountyOnMap(page);
    await expect(mapControl(page, '放大地圖')).toBeVisible();
    await expect(mapControl(page, '縮小地圖')).toBeVisible();
    await expect(mapControl(page, '重設地圖範圍')).toBeVisible();
    await expect(page.getByRole('region', { name: '天氣資訊' })).toBeVisible();
    await expect.poll(async () => boxesOverlap(
      weatherMap(page),
      page.getByRole('region', { name: '天氣資訊' }),
    )).toBe(false);
    await expectNoTaiwanMdBranding(page);
    expectNoForbiddenMapRequests(forbiddenUrls);
  });

  test('should reveal and preserve the mobile weather bottom sheet at 390x844', async ({
    page,
  }) => {
    const forbiddenUrls = await gotoWeatherPage(page, MOBILE_VIEWPORT);

    await selectCountyOnMap(page);

    const weatherSheet = page.getByRole('region', { name: '天氣資訊' });
    await expect(weatherSheet).toBeVisible();
    await expect(weatherSheet).toContainText(/目前選取：/);
    await expect(page.getByRole('button', { name: '收合天氣資訊' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await page.getByRole('button', { name: '收合天氣資訊' }).click();

    await expect(page.getByRole('button', { name: '展開天氣資訊' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(weatherSheet).toContainText(/目前選取：/);
    await expect(page.getByTestId('weather-sheet-content')).toBeHidden();
    await expect(page.getByRole('button', { name: /加入收藏/i })).toBeHidden();

    await neutralizeNextDevOverlayPointerInterceptionForMobileClick(page);
    await page.getByRole('button', { name: '展開天氣資訊' }).click();

    await expect(page.getByTestId('current-temperature')).toBeVisible();
    await expect(page.getByRole('button', { name: /加入收藏/i })).toBeVisible();

    await page.getByRole('button', { name: /全台總覽/ }).click();

    await expect(page.getByText('請先在地圖上選擇')).toBeVisible();
    await expect(page.getByText(/目前選取：/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: '收合天氣資訊' })).toHaveCount(0);
    await expectNoTaiwanMdBranding(page);
    expectNoForbiddenMapRequests(forbiddenUrls);
  });
});
