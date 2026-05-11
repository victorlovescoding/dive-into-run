import { expect, test } from '@playwright/test';

import { collectReactHydrationErrors } from './quality-gate-helpers.js';

const HYDRATION_ROUTE_CASES = Object.freeze([
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

test.describe('React hydration smoke', () => {
  for (const { label, path, heading } of HYDRATION_ROUTE_CASES) {
    test(`${label} route has no React hydration mismatch`, async ({ page }) => {
      const hydrationErrors = collectReactHydrationErrors(page);

      try {
        await page.goto(path);
        await expect(page.getByRole('heading', { name: heading })).toBeVisible();
        hydrationErrors.assertNoErrors();
      } finally {
        hydrationErrors.dispose();
      }
    });
  }
});
