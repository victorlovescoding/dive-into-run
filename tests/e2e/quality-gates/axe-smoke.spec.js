import { expect, test } from '@playwright/test';

import {
  attachAxeReportOnly,
  compareAxeViolationsToBaseline,
  normalizeAxeViolationEntries,
  normalizeAxeViolationSignatures,
  validateAxeInteractiveBaseline,
} from './quality-gate-helpers.js';

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

  test('normalizes axe violation entries in stable sorted order', () => {
    const entries = normalizeAxeViolationEntries([
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

    expect(entries).toEqual([
      {
        ruleId: 'aria-dialog-name',
        impact: 'critical',
        target: '#dialog',
        signature: 'aria-dialog-name|critical|#dialog',
      },
      {
        ruleId: 'color-contrast',
        impact: 'serious',
        target: '.primary',
        signature: 'color-contrast|serious|.primary',
      },
      {
        ruleId: 'color-contrast',
        impact: 'serious',
        target: '.secondary',
        signature: 'color-contrast|serious|.secondary',
      },
    ]);
  });

  test('compares axe entries against scoped interactive baseline', () => {
    const comparison = compareAxeViolationsToBaseline({
      route: '/events/test-event-comments',
      state: 'event-comment-edit-dialog',
      current: [
        {
          ruleId: 'aria-required-children',
          impact: 'critical',
          target: 'div[role="menu"]',
          signature: 'aria-required-children|critical|div[role="menu"]',
        },
        {
          ruleId: 'aria-dialog-name',
          impact: 'serious',
          target: '#edit-dialog',
          signature: 'aria-dialog-name|serious|#edit-dialog',
        },
      ],
      baseline: {
        version: 1,
        generatedFor: 'axe-interactive-emulator',
        metadata: {
          createdOn: '2026-05-12',
          sourceFeature: '046-quality-gates',
          sourceSpec: 'tests/e2e/quality-gates/axe-interactive-emulator.spec.js',
          reviewedScope: 'event comment interactive states only',
        },
        entries: [
          {
            route: '/events/test-event-comments',
            state: 'event-comment-edit-dialog',
            ruleId: 'aria-required-children',
            impact: 'critical',
            target: 'div[role="menu"]',
            signature: 'aria-required-children|critical|div[role="menu"]',
            reason: 'Known existing finding reviewed before PR C hard-gate rollout.',
            owner: 'quality-gates',
            expiry: '2026-08-12',
          },
          {
            route: '/events/test-event-comments',
            state: 'event-comment-edit-dialog',
            ruleId: 'color-contrast',
            impact: 'serious',
            target: '.old-node',
            signature: 'color-contrast|serious|.old-node',
            reason: 'Known existing finding reviewed before PR C hard-gate rollout.',
            owner: 'quality-gates',
            expiry: '2026-08-12',
          },
          {
            route: '/events/test-event-comments',
            state: 'event-comment-delete-confirm-dialog',
            ruleId: 'aria-dialog-name',
            impact: 'serious',
            target: '#edit-dialog',
            signature: 'aria-dialog-name|serious|#edit-dialog',
            reason: 'Known finding in a different state must not allow edit dialog.',
            owner: 'quality-gates',
            expiry: '2026-08-12',
          },
        ],
      },
    });

    expect(comparison.baselineKnown.map((entry) => entry.signature)).toEqual([
      'aria-required-children|critical|div[role="menu"]',
    ]);
    expect(comparison.newSignatures.map((entry) => entry.signature)).toEqual([
      'aria-dialog-name|serious|#edit-dialog',
    ]);
    expect(comparison.noLongerObserved.map((entry) => entry.signature)).toEqual([
      'color-contrast|serious|.old-node',
    ]);
  });

  test('rejects malformed interactive axe baseline entries', () => {
    expect(() =>
      validateAxeInteractiveBaseline({
        version: 1,
        generatedFor: 'axe-interactive-emulator',
        metadata: {
          createdOn: '2026-05-12',
          sourceFeature: '046-quality-gates',
          sourceSpec: 'tests/e2e/quality-gates/axe-interactive-emulator.spec.js',
          reviewedScope: 'event comment interactive states only',
        },
        entries: [
          {
            route: '/events/test-event-comments',
            state: 'event-comment-edit-dialog',
            ruleId: 'aria-required-children',
            impact: 'critical',
            target: 'div[role="menu"]',
            signature: 'aria-required-children|critical|div[role="menu"]',
            reason: '',
            owner: 'quality-gates',
            expiry: '2026-08-12',
          },
        ],
      }),
    ).toThrow(/entries\[0\]\.reason/);
  });

  for (const { label, path, heading } of AXE_ROUTE_CASES) {
    test(`${label} route attaches axe report`, async ({ page }, testInfo) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();

      await attachAxeReportOnly(page, testInfo, label);
    });
  }
});
