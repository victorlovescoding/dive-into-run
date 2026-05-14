import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = 'reports/type-check-strict';
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const PROJECT_PATH = path.join(REPO_ROOT, 'tsconfig.strict.json');
const OUT_DIR_PATH = path.join(REPO_ROOT, OUT_DIR);
const TSC_BIN = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));

const STRICT_HARD_GATE_CRITERIA = Object.freeze({
  scope: 'Only files explicitly listed in tsconfig.strict.json are in the strict island.',
  failureMessage:
    'Strict TypeScript/JSDoc island failed. Fix the listed strict errors or roll back the file that expanded tsconfig.strict.json.',
  rollbackPath:
    'Remove the most recent explicit file entry from tsconfig.strict.json, then rerun the strict island command.',
  blockingExitCriteria:
    'The runner may become blocking only after tsconfig.strict.json is clean on main and every file addition keeps the strict island clean in CI.',
});

/**
 * Runs the strict TypeScript/JSDoc island as a report-only check.
 * @returns {number} Always returns zero so this report does not block CI.
 */
function main() {
  const result = spawnSync(
    process.execPath,
    [TSC_BIN, '--noEmit', '--project', PROJECT_PATH, '--pretty', 'false'],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    }
  );
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const status = result.status ?? 1;
  const report = output || `Strict report completed with exit code ${status} and no compiler output.\n`;

  mkdirSync(OUT_DIR_PATH, { recursive: true });
  writeFileSync(path.join(OUT_DIR_PATH, 'strict-report.txt'), report);
  writeFileSync(
    path.join(OUT_DIR_PATH, 'strict-report.json'),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        command: 'tsc --noEmit --project tsconfig.strict.json --pretty false',
        exitCode: status,
        status: 'report-only',
        reportPath: path.join(OUT_DIR, 'strict-report.txt'),
        hardGateCriteria: STRICT_HARD_GATE_CRITERIA,
      },
      null,
      2
    )}\n`
  );

  if (status === 0) {
    console.log(`Strict TypeScript/JSDoc report passed; wrote ${OUT_DIR}/strict-report.txt`);
  } else {
    console.warn(
      `Strict TypeScript/JSDoc report found issues with exit code ${status}; wrote ${OUT_DIR}/strict-report.txt`
    );
  }

  return 0;
}

process.exitCode = main();
