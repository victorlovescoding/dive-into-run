import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseNextBuildRouteMetrics } from '../../../scripts/check-next-build-budget.mjs';

describe('parseNextBuildRouteMetrics', () => {
  it('extracts route size and first-load gzip metrics from Next 15 build output', () => {
    const buildOutput = readFileSync('tests/unit/scripts/fixtures/next-15-build-output.txt', 'utf8');
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
