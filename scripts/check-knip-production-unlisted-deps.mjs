import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const KNIP_BIN = path.join('node_modules', '.bin', 'knip');
const KNIP_ARGS = [
  '--production',
  '--include',
  'dependencies,unlisted',
  '--no-exit-code',
  '--reporter',
  'json',
];

const GATE_NAME = 'Knip production unlisted-deps gate';

/**
 * @typedef {object} KnipUnlistedFinding
 * @property {string} name Unlisted dependency package name reported by Knip.
 * @property {string} file Repo-relative file path containing the unlisted dependency.
 * @property {number | null} line Source line for the finding when Knip reports one.
 * @property {number | null} col Source column for the finding when Knip reports one.
 */

/**
 * Parses Knip JSON and extracts only unlisted dependency findings.
 * @param {string} jsonText Raw stdout from Knip's JSON reporter.
 * @returns {KnipUnlistedFinding[]} Normalized unlisted dependency findings.
 */
export function parseKnipProductionUnlistedDepsReport(jsonText) {
  if (typeof jsonText !== 'string' || jsonText.trim() === '') {
    throw new Error('missing Knip JSON output');
  }

  const jsonPayload = extractKnipJsonPayload(jsonText);
  let report;
  try {
    report = JSON.parse(jsonPayload);
  } catch (error) {
    throw new Error(`malformed Knip JSON: ${error.message}`);
  }

  if (!report || typeof report !== 'object' || !Array.isArray(report.issues)) {
    throw new Error('malformed Knip JSON: missing issues array');
  }

  return report.issues.flatMap((issue) => extractIssueUnlistedFindings(issue));
}

/**
 * Knip's JSON reporter writes JSON, but repo startup hooks can print banners
 * before Knip emits the report. Keep strict JSON parsing after the first object.
 * @param {string} output Raw command output that may contain banner lines.
 * @returns {string} Trimmed JSON payload starting at the first object line.
 */
function extractKnipJsonPayload(output) {
  const trimmed = output.trim();

  if (trimmed.startsWith('{')) {
    return trimmed;
  }

  const jsonStartLine = output.split(/\r?\n/u).findIndex((line) => line.trimStart().startsWith('{'));

  if (jsonStartLine === -1) {
    throw new Error('malformed Knip JSON: missing JSON object');
  }

  return output.split(/\r?\n/u).slice(jsonStartLine).join('\n').trim();
}

/**
 * Evaluates a Knip process result for the production unlisted-deps gate.
 * @param {{ stdout: string, stderr: string, status: number, error?: Error }} result Completed Knip process result.
 * @returns {{ exitCode: number, stdout: string, stderr: string }} Gate result ready for process output.
 */
export function evaluateKnipProductionUnlistedDepsResult(result) {
  if (result.error) {
    return failClosed(`Knip spawn error: ${result.error.message}`, result.stderr);
  }

  if (result.status !== 0) {
    return failClosed(`Knip exited with status ${result.status}`, result.stderr);
  }

  let findings;
  try {
    findings = parseKnipProductionUnlistedDepsReport(result.stdout);
  } catch (error) {
    return failClosed(error.message, result.stderr);
  }

  if (findings.length > 0) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `${GATE_NAME} failed: found production unlisted dependencies:\n${findings
        .map(formatFinding)
        .join('\n')}\n`,
    };
  }

  return {
    exitCode: 0,
    stdout: `${GATE_NAME} passed: no production unlisted dependencies found.\n`,
    stderr: '',
  };
}

/**
 * Runs Knip's production JSON report.
 * @returns {{ stdout: string, stderr: string, status: number, error?: Error }} Spawn result normalized for gate evaluation.
 */
export function runKnipProductionUnlistedDepsReport() {
  const result = spawnSync(KNIP_BIN, KNIP_ARGS, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1,
    error: result.error,
  };
}

/**
 * Runs the gate and writes a human-readable result.
 * @returns {number} Process exit code for the gate command.
 */
export function main() {
  const result = evaluateKnipProductionUnlistedDepsResult(runKnipProductionUnlistedDepsReport());

  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);

  return result.exitCode;
}

/**
 * @param {unknown} issue Raw Knip issue entry from the JSON report.
 * @returns {KnipUnlistedFinding[]} Normalized unlisted findings for the issue file.
 */
function extractIssueUnlistedFindings(issue) {
  const issueObject = toRecord(issue);

  if (!issueObject) {
    throw new Error('malformed Knip JSON: issue must be an object');
  }

  const fileValue = issueObject['file'];
  const file = typeof fileValue === 'string' && fileValue !== '' ? fileValue : 'unknown';
  const unlisted = issueObject['unlisted'] ?? [];

  if (!Array.isArray(unlisted)) {
    throw new Error(`malformed Knip JSON: ${file} unlisted must be an array`);
  }

  return unlisted.map((dependency) => normalizeUnlistedDependency(file, dependency));
}

/**
 * @param {string} file Repo-relative file path associated with the dependency.
 * @param {unknown} dependency Raw Knip unlisted dependency entry.
 * @returns {KnipUnlistedFinding} Normalized unlisted dependency finding.
 */
function normalizeUnlistedDependency(file, dependency) {
  const dependencyObject = toRecord(dependency);
  const name = dependencyObject?.['name'];

  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error(`malformed Knip JSON: ${file} unlisted dependency is missing a name`);
  }

  const line = dependencyObject['line'];
  const col = dependencyObject['col'];

  return {
    name,
    file,
    line: typeof line === 'number' && Number.isInteger(line) ? line : null,
    col: typeof col === 'number' && Number.isInteger(col) ? col : null,
  };
}

/**
 * @param {unknown} value Value to narrow to a plain object record.
 * @returns {Record<string, unknown> | null} Record view of the value, or null for non-objects.
 */
function toRecord(value) {
  return value && typeof value === 'object' ? /** @type {Record<string, unknown>} */ (value) : null;
}

/**
 * @param {KnipUnlistedFinding} finding Normalized finding to render.
 * @returns {string} Human-readable finding with location and package name.
 */
function formatFinding(finding) {
  const location =
    finding.line === null
      ? finding.file
      : `${finding.file}:${finding.line}${finding.col === null ? '' : `:${finding.col}`}`;

  return `${location} ${finding.name}`;
}

/**
 * @param {string} reason Failure reason to include in stderr.
 * @param {string} stderr Original stderr from Knip, if any.
 * @returns {{ exitCode: 1, stdout: string, stderr: string }} Failed gate result that preserves diagnostic detail.
 */
function failClosed(reason, stderr) {
  const detail = stderr.trim() === '' ? '' : `\n${stderr.trim()}`;

  return {
    exitCode: 1,
    stdout: '',
    stderr: `${GATE_NAME} failed closed: ${reason}.${detail}\n`,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main();
}
