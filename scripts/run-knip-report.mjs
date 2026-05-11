import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const KNIP_BIN = path.join('node_modules', '.bin', 'knip');

/**
 * Runs Knip and returns captured output.
 * @param {string[]} args - Knip CLI arguments.
 * @returns {{ stdout: string, stderr: string, status: number }} Captured process result.
 */
function runKnip(args) {
  const result = spawnSync(KNIP_BIN, args, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1,
  };
}

/**
 * Runs a compact Knip report and writes a JSON artifact without hard failing.
 * @returns {number} Always exits zero because this gate is report-only.
 */
function main() {
  const compact = runKnip(['--no-exit-code', '--reporter', 'compact']);
  const json = runKnip(['--no-exit-code', '--reporter', 'json']);

  process.stdout.write(compact.stdout);
  process.stderr.write(compact.stderr);
  writeFileSync('knip-report.json', json.stdout || '{"issues":[]}\n');

  if (compact.status !== 0 || json.status !== 0) {
    console.warn(
      `Knip report completed with non-zero internal status compact=${compact.status} json=${json.status}; wrote knip-report.json`
    );
  }

  return 0;
}

process.exitCode = main();
