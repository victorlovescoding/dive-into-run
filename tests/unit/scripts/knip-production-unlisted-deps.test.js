import { describe, expect, it } from 'vitest';

import {
  evaluateKnipProductionUnlistedDepsResult,
  parseKnipProductionUnlistedDepsReport,
} from '../../../scripts/check-knip-production-unlisted-deps.mjs';

describe('parseKnipProductionUnlistedDepsReport', () => {
  it('returns only production unlisted dependency findings from Knip JSON', () => {
    const findings = parseKnipProductionUnlistedDepsReport(
      JSON.stringify({
        files: ['src/unused.js'],
        issues: [
          {
            file: 'package.json',
            dependencies: [{ name: 'unused-prod' }],
            devDependencies: [{ name: 'unused-dev' }],
            unlisted: [],
            exports: [{ name: 'unusedExport' }],
          },
          {
            file: 'src/app/page.jsx',
            unlisted: [
              { name: 'transitive-prod', line: 3, col: 11 },
              { name: '@scope/missing-prod' },
            ],
            unresolved: [{ name: './missing-file' }],
          },
        ],
      })
    );

    expect(findings).toEqual([
      {
        name: 'transitive-prod',
        file: 'src/app/page.jsx',
        line: 3,
        col: 11,
      },
      {
        name: '@scope/missing-prod',
        file: 'src/app/page.jsx',
        line: null,
        col: null,
      },
    ]);
  });

  it('accepts Knip JSON after tool startup noise on stdout', () => {
    const findings = parseKnipProductionUnlistedDepsReport(
      [
        '[dotenv@17.3.1] injecting env (15) from .env',
        JSON.stringify({
          issues: [
            {
              file: 'src/app/page.jsx',
              unlisted: [{ name: 'transitive-prod' }],
            },
          ],
        }),
      ].join('\n')
    );

    expect(findings).toEqual([
      {
        name: 'transitive-prod',
        file: 'src/app/page.jsx',
        line: null,
        col: null,
      },
    ]);
  });
});

describe('evaluateKnipProductionUnlistedDepsResult', () => {
  it('passes when Knip JSON contains only unused files, unused exports, and dev-only findings', () => {
    const result = evaluateKnipProductionUnlistedDepsResult({
      stdout: JSON.stringify({
        files: ['src/unused.js'],
        issues: [
          {
            file: 'package.json',
            dependencies: [{ name: 'unused-prod' }],
            devDependencies: [{ name: 'unused-dev' }],
            exports: [{ name: 'unusedExport' }],
            unlisted: [],
          },
        ],
      }),
      stderr: '',
      status: 0,
    });

    expect(result).toMatchObject({
      exitCode: 0,
      stderr: '',
    });
    expect(result.stdout).toContain('Knip production unlisted-deps gate passed');
  });

  it('blocks production unlisted dependency findings', () => {
    const result = evaluateKnipProductionUnlistedDepsResult({
      stdout: JSON.stringify({
        issues: [
          {
            file: 'src/app/page.jsx',
            unlisted: [{ name: 'transitive-prod', line: 3, col: 11 }],
          },
        ],
      }),
      stderr: '',
      status: 0,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Knip production unlisted-deps gate failed');
    expect(result.stderr).toContain('src/app/page.jsx:3:11 transitive-prod');
  });

  it('fails closed when Knip JSON is missing or malformed', () => {
    const missing = evaluateKnipProductionUnlistedDepsResult({
      stdout: '',
      stderr: '',
      status: 0,
    });
    const malformed = evaluateKnipProductionUnlistedDepsResult({
      stdout: '{"issues":',
      stderr: '',
      status: 0,
    });

    expect(missing.exitCode).toBe(1);
    expect(missing.stderr).toContain('Knip production unlisted-deps gate failed closed');
    expect(missing.stderr).toContain('missing Knip JSON output');
    expect(malformed.exitCode).toBe(1);
    expect(malformed.stderr).toContain('Knip production unlisted-deps gate failed closed');
    expect(malformed.stderr).toContain('malformed Knip JSON');
  });

  it('fails closed when Knip cannot run successfully', () => {
    const result = evaluateKnipProductionUnlistedDepsResult({
      stdout: '',
      stderr: 'spawn node_modules/.bin/knip ENOENT',
      status: 1,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Knip production unlisted-deps gate failed closed');
    expect(result.stderr).toContain('Knip exited with status 1');
    expect(result.stderr).toContain('spawn node_modules/.bin/knip ENOENT');
  });
});
