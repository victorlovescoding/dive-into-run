import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import { parseNextBuildRouteMetrics } from '../../../scripts/check-next-build-budget.mjs';

const require = createRequire(import.meta.url);
const FIXTURE_PATH = 'tests/unit/scripts/fixtures/next-15-build-output.txt';

/**
 * @typedef {object} NextBuildBudgetReport
 * @property {string} status Report-only budget status.
 * @property {{ status?: string }} budgetConfig Parsed budget configuration metadata.
 * @property {Array<Record<string, unknown>>} warnings Report-only warning entries.
 * @property {number} routeCount Parsed route metric count.
 * @property {Array<Record<string, unknown>>} findings Budget finding entries.
 */

/**
 * @returns {string} Temporary directory path for budget report outputs.
 */
function createTempDir() {
  return mkdtempSync(path.join(tmpdir(), 'next-build-budget-'));
}

/**
 * @param {string[]} args CLI arguments passed to the budget report script.
 * @param {Record<string, string | undefined>} env Environment overrides for the spawned process.
 * @returns {import('node:child_process').SpawnSyncReturns<string>} Spawn result from the budget report script.
 */
function runBudgetReport(args, env = {}) {
  return spawnSync('node', ['scripts/check-next-build-budget.mjs', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      BUNDLE_BUDGET_FIRST_LOAD_KB: undefined,
      BUNDLE_BUDGET_ROUTE_SIZE_KB: undefined,
      ...env,
    },
  });
}

/**
 * @param {string} outDir Directory containing the generated JSON report.
 * @returns {NextBuildBudgetReport} Parsed budget report payload.
 */
function readJsonReport(outDir) {
  return JSON.parse(readFileSync(path.join(outDir, 'next-build-budget.json'), 'utf8'));
}

describe('parseNextBuildRouteMetrics', () => {
  it('extracts route size and first-load gzip metrics from Next 15 build output', () => {
    const buildOutput = readFileSync(FIXTURE_PATH, 'utf8');
    const report = parseNextBuildRouteMetrics(buildOutput);

    expect(report.routes).toEqual([
      { route: '/', kind: '○', sizeBytes: 3195, firstLoadJsBytes: 148480 },
      { route: '/_not-found', kind: '○', sizeBytes: 992, firstLoadJsBytes: 104448 },
      { route: '/api/strava/callback', kind: 'ƒ', sizeBytes: 142, firstLoadJsBytes: 103424 },
      { route: '/events/[id]', kind: 'ƒ', sizeBytes: 8202, firstLoadJsBytes: 167936 },
    ]);
    expect(report.sharedFirstLoadJsBytes).toBe(103424);
  });
});

describe('check-next-build-budget report output', () => {
  it('marks missing bundle budget config as a report-only warning in JSON and Markdown', () => {
    const outDir = createTempDir();
    const result = runBudgetReport(['--input', FIXTURE_PATH, '--out-dir', outDir]);

    expect(result.status).toBe(0);

    const report = readJsonReport(outDir);
    const markdown = readFileSync(path.join(outDir, 'next-build-budget.md'), 'utf8');

    expect(report.status).toBe('warning');
    expect(report.budgetConfig.status).toBe('missing');
    expect(report.warnings).toContainEqual({
      code: 'missing-budget-config',
      message:
        'Bundle budget env vars are unset; report-only budget comparison was skipped.',
    });
    expect(markdown).toContain('Status: warning');
    expect(markdown).toContain('Budget config: missing');
    expect(markdown).toContain('missing-budget-config');
  });

  it('records zero parsed routes in the report while keeping the command report-only', () => {
    const outDir = createTempDir();
    const inputPath = path.join(outDir, 'empty-build-output.txt');
    writeFileSync(inputPath, '   ▲ Next.js 15.4.6\n ✓ Compiled successfully\n');

    const result = runBudgetReport(['--input', inputPath, '--out-dir', outDir]);

    expect(result.status).toBe(0);

    const report = readJsonReport(outDir);
    const markdown = readFileSync(path.join(outDir, 'next-build-budget.md'), 'utf8');

    expect(report.routeCount).toBe(0);
    expect(report.status).toBe('warning');
    expect(report.warnings).toContainEqual({
      code: 'no-route-metrics',
      message: 'No Next route metrics were parsed from the build output.',
    });
    expect(markdown).toContain('no-route-metrics');
  });

  it('keeps configured budget overages as report-only warnings', () => {
    const outDir = createTempDir();
    const result = runBudgetReport(['--input', FIXTURE_PATH, '--out-dir', outDir], {
      BUNDLE_BUDGET_FIRST_LOAD_KB: '120',
      BUNDLE_BUDGET_ROUTE_SIZE_KB: '4',
    });

    expect(result.status).toBe(0);

    const report = readJsonReport(outDir);

    expect(report.status).toBe('warning');
    expect(report.budgetConfig.status).toBe('configured');
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'warning',
          route: '/',
          metric: 'firstLoadJs',
        }),
        expect.objectContaining({
          level: 'warning',
          route: '/events/[id]',
          metric: 'size',
        }),
      ])
    );
  });
});

describe('LHCI report-only policy', () => {
  it('uses repeated route collection with filesystem output and no hard performance gate', () => {
    const config = require('../../../.lighthouserc.cjs');

    expect(config.ci.collect.url).toEqual([
      'http://localhost:3000/',
      'http://localhost:3000/events',
      'http://localhost:3000/weather',
    ]);
    expect(config.ci.collect.numberOfRuns).toBeGreaterThan(1);
    expect(config.ci.assert.assertions['categories:performance']).toBe('off');
    expect(config.ci.upload.target).toBe('filesystem');
    expect(config.ci.upload.outputDir).toBe('./lhci-report');
  });
});
