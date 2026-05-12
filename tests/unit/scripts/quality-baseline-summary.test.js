import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  summarizeQualityBaselines,
} from '../../../scripts/summarize-quality-baselines.mjs';

/**
 * @returns {string} Temporary repository root for quality baseline fixtures.
 */
function createTempRepo() {
  return mkdtempSync(path.join(tmpdir(), 'quality-baseline-summary-'));
}

/**
 * @param {string} root Temporary repository root to write into.
 * @param {string} relativePath Repo-relative JSON fixture path.
 * @param {unknown} payload JSON payload to write.
 * @returns {void}
 */
function writeJson(root, relativePath, payload) {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

describe('summarizeQualityBaselines', () => {
  it('summarizes ignored quality artifacts into an ignored JSON report', () => {
    const repoRoot = createTempRepo();

    writeJson(repoRoot, 'knip-report.json', {
      files: ['src/legacy-unused.js'],
      issues: [
        {
          file: 'src/app/page.jsx',
          dependencies: [{ name: 'unused-prod' }],
          devDependencies: [{ name: 'unused-dev' }],
          unlisted: [{ name: 'transitive-prod' }],
          exports: [{ name: 'unusedExport' }],
        },
      ],
    });
    writeJson(repoRoot, 'reports/bundle-budget/next-build-budget.json', {
      status: 'warning',
      routeCount: 2,
      warnings: [{ code: 'missing-budget-config' }],
      findings: [{ level: 'warning', route: '/', metric: 'firstLoadJs' }],
      largestFirstLoadRoute: { route: '/events', firstLoadJsBytes: 167936 },
    });
    writeJson(repoRoot, 'reports/type-check-strict/strict-report.json', {
      exitCode: 2,
      reportPath: 'reports/type-check-strict/strict-report.txt',
    });
    writeJson(repoRoot, 'lhci-report/manifest.json', [
      {
        url: 'http://localhost:3000/',
        isRepresentativeRun: true,
        summary: { performance: 0.82, accessibility: 0.97 },
      },
      {
        url: 'http://localhost:3000/events',
        isRepresentativeRun: true,
        summary: { performance: 0.74, accessibility: 0.94 },
      },
    ]);

    const summary = summarizeQualityBaselines({
      repoRoot,
      outDir: 'reports/quality-baselines',
      generatedAt: '2026-05-12T00:00:00.000Z',
    });

    expect(summary).toMatchObject({
      generatedAt: '2026-05-12T00:00:00.000Z',
      status: 'report-only',
      sources: {
        knip: {
          present: true,
          unusedFileCount: 1,
          issueFileCount: 1,
          unusedDependencyCount: 1,
          unlistedDependencyCount: 1,
          unusedExportCount: 1,
        },
        bundleBudget: {
          present: true,
          status: 'warning',
          routeCount: 2,
          warningCount: 1,
          findingCount: 1,
          largestFirstLoadRoute: '/events',
        },
        strictTypeCheck: {
          present: true,
          exitCode: 2,
          reportPath: 'reports/type-check-strict/strict-report.txt',
        },
        lighthouse: {
          present: true,
          runCount: 2,
          representativeRunCount: 2,
          urls: ['http://localhost:3000/', 'http://localhost:3000/events'],
          minPerformanceScore: 0.74,
        },
      },
    });
    expect(summary.outputPath).toBe('reports/quality-baselines/summary.json');

    const written = JSON.parse(
      readFileSync(path.join(repoRoot, 'reports/quality-baselines/summary.json'), 'utf8')
    );
    expect(written).toEqual(summary);
  });

  it('marks missing raw artifacts without failing the report-only summary', () => {
    const repoRoot = createTempRepo();

    const summary = summarizeQualityBaselines({
      repoRoot,
      outDir: 'reports/quality-baselines',
      generatedAt: '2026-05-12T00:00:00.000Z',
    });

    expect(summary.status).toBe('report-only');
    expect(summary.sources.knip).toMatchObject({
      present: false,
      path: 'knip-report.json',
    });
    expect(summary.sources.bundleBudget.present).toBe(false);
    expect(summary.sources.strictTypeCheck.present).toBe(false);
    expect(summary.sources.lighthouse.present).toBe(false);
  });
});
