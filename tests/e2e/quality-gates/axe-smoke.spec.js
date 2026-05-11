import { expect, test } from '@playwright/test';

import { attachAxeReportOnly } from './quality-gate-helpers.js';

const AXE_ROUTE_CASES = Object.freeze([
  {
    label: 'home',
    path: '/',
    heading: /Dive Into Run/i,
  },
  {
    label: 'events',
    path: '/events',
    heading: /這是揪團跑步頁面/,
  },
  {
    label: 'posts',
    path: '/posts',
    heading: /文章河道/,
  },
]);

test.describe('axe smoke report-only', () => {
  for (const { label, path, heading } of AXE_ROUTE_CASES) {
    test(`${label} route attaches axe report`, async ({ page }, testInfo) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();

      await attachAxeReportOnly(page, testInfo, label);
    });
  }
});
