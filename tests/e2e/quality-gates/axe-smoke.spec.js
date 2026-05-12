import { expect, test } from '@playwright/test';

import { attachAxeReportOnly, normalizeAxeViolationSignatures } from './quality-gate-helpers.js';

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
  test('normalizes axe violation signatures in stable sorted order', () => {
    const signatures = normalizeAxeViolationSignatures([
      {
        id: 'color-contrast',
        impact: 'serious',
        nodes: [{ target: ['.secondary'] }, { target: ['.primary'] }],
      },
      {
        id: 'aria-dialog-name',
        impact: 'critical',
        nodes: [{ target: ['#dialog'] }],
      },
    ]);

    expect(signatures).toEqual([
      'aria-dialog-name|critical|#dialog',
      'color-contrast|serious|.primary',
      'color-contrast|serious|.secondary',
    ]);
  });

  for (const { label, path, heading } of AXE_ROUTE_CASES) {
    test(`${label} route attaches axe report`, async ({ page }, testInfo) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();

      await attachAxeReportOnly(page, testInfo, label);
    });
  }
});
