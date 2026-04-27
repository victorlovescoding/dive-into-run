// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { countTotalPoints, toMs, toNumber } from '@/runtime/events/event-runtime-helpers';
import depCruiseConfig from '../../../.dependency-cruiser.mjs';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const CANONICAL_DIRECTORIES = [
  'src/types',
  'src/config',
  'src/repo',
  'src/service',
  'src/runtime',
  'src/ui',
];
const LIB_REFERENCE_PATTERN = /@\/lib\//;

/**
 * Recursively collects JavaScript source files from the provided directory.
 * @param {string} directory - Directory path relative to the project root.
 * @returns {string[]} Absolute file paths.
 */
function collectSourceFiles(directory) {
  const absoluteDirectory = path.join(PROJECT_ROOT, directory);
  const entries = fs.readdirSync(absoluteDirectory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const entryPath = path.join(absoluteDirectory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(path.relative(PROJECT_ROOT, entryPath));
    }
    if (!/\.(?:js|jsx|mjs)$/.test(entry.name)) {
      return [];
    }
    return [entryPath];
  });
}

describe('S025 canonical no-import-lib enforcement', () => {
  it('registers the dep-cruise rule with the shared non-runtime dependency-type filter', () => {
    const rule = depCruiseConfig.forbidden.find(
      (candidate) => candidate.name === 'canonical-no-import-lib',
    );

    expect(rule).toMatchObject({
      severity: 'error',
      from: {
        path: expect.stringContaining('src/runtime'),
      },
      to: {
        path: '^src/lib(?:/|$)',
        dependencyTypesNot: expect.arrayContaining(['jsdoc', 'type-only', 'type-import']),
      },
    });
    expect(rule.from.path).not.toContain('src/components');
    expect(rule.from.path).not.toContain('src/app');
    expect(rule.from.path).not.toContain('src/contexts');
    expect(rule.from.path).not.toContain('src/hooks');
  });

  it('leaves canonical source files free of @/lib references after the retarget', () => {
    const offendingFiles = CANONICAL_DIRECTORIES.flatMap((directory) =>
      collectSourceFiles(directory)
        .filter((filePath) => LIB_REFERENCE_PATTERN.test(fs.readFileSync(filePath, 'utf8')))
        .map((filePath) => path.relative(PROJECT_ROOT, filePath)),
    );

    expect(offendingFiles).toEqual([]);
  });

  it('keeps the new runtime and ui helpers behaviorally stable', () => {
    expect(
      countTotalPoints([
        [{ lat: 1, lng: 2 }],
        [
          { lat: 3, lng: 4 },
          { lat: 5, lng: 6 },
        ],
      ]),
    ).toBe(3);
    expect(toNumber('12')).toBe(12);
    expect(toNumber('oops')).toBe(0);
    expect(toMs('2026-04-23T08:30:00Z')).toBe(new Date('2026-04-23T08:30:00Z').getTime());
  });
});
