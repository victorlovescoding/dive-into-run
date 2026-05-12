import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_OUT_DIR = 'reports/quality-baselines';
const OUTPUT_FILE_NAME = 'summary.json';

const RAW_ARTIFACTS = Object.freeze({
  knip: 'knip-report.json',
  bundleBudget: 'reports/bundle-budget/next-build-budget.json',
  strictTypeCheck: 'reports/type-check-strict/strict-report.json',
  lighthouse: 'lhci-report/manifest.json',
});

/**
 * @typedef {object} QualityBaselineSummaryOptions
 * @property {string} [repoRoot] Repository root containing ignored raw artifacts.
 * @property {string} [outDir] Ignored output directory for the summary JSON.
 * @property {string} [generatedAt] Optional stable timestamp for deterministic tests.
 */

/**
 * @typedef {object} ArtifactSummary
 * @property {boolean} present Whether the raw artifact exists.
 * @property {string} path Repo-relative raw artifact path.
 * @property {number} [unusedFileCount] Knip unused file count.
 * @property {number} [issueFileCount] Knip issue file count.
 * @property {number} [unusedDependencyCount] Knip unused production dependency count.
 * @property {number} [unlistedDependencyCount] Knip unlisted dependency count.
 * @property {number} [unusedExportCount] Knip unused export count.
 * @property {string} [status] Report-only status from a raw artifact.
 * @property {number | null} [routeCount] Parsed Next route count.
 * @property {number} [warningCount] Report-only warning count.
 * @property {number} [findingCount] Report-only finding count.
 * @property {string | null} [largestFirstLoadRoute] Largest First Load JS route.
 * @property {number | null} [exitCode] Raw command exit code.
 * @property {string | null} [reportPath] Repo-relative human report path.
 * @property {number} [runCount] Lighthouse run count.
 * @property {number} [representativeRunCount] Lighthouse representative run count.
 * @property {string[]} [urls] Lighthouse representative URLs.
 * @property {number | null} [minPerformanceScore] Lowest representative performance score.
 */

/**
 * @typedef {object} QualityBaselineSummary
 * @property {string} generatedAt ISO timestamp for the summary.
 * @property {'report-only'} status Summary policy; never a hard gate.
 * @property {string} outputPath Repo-relative summary JSON output path.
 * @property {{ knip: ArtifactSummary, bundleBudget: ArtifactSummary, strictTypeCheck: ArtifactSummary, lighthouse: ArtifactSummary }} sources Raw artifact summaries.
 */

/**
 * Reads ignored raw quality artifacts and writes a report-only baseline summary.
 * @param {QualityBaselineSummaryOptions} options Summary options.
 * @returns {QualityBaselineSummary} Report-only baseline summary.
 */
export function summarizeQualityBaselines(options = {}) {
  const repoRoot = options.repoRoot ?? fileURLToPath(new URL('..', import.meta.url));
  const outDir = options.outDir ?? DEFAULT_OUT_DIR;
  const outputPath = path.join(outDir, OUTPUT_FILE_NAME);
  /** @type {QualityBaselineSummary} */
  const summary = {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    status: 'report-only',
    outputPath,
    sources: {
      knip: summarizeKnip(repoRoot),
      bundleBudget: summarizeBundleBudget(repoRoot),
      strictTypeCheck: summarizeStrictTypeCheck(repoRoot),
      lighthouse: summarizeLighthouse(repoRoot),
    },
  };

  const absoluteOutDir = path.join(repoRoot, outDir);
  mkdirSync(absoluteOutDir, { recursive: true });
  writeFileSync(path.join(absoluteOutDir, OUTPUT_FILE_NAME), `${JSON.stringify(summary, null, 2)}\n`);

  return summary;
}

/**
 * @param {string} repoRoot Absolute repository root used to find the Knip report.
 * @returns {ArtifactSummary} Summary of Knip unused and unlisted dependency counts.
 */
function summarizeKnip(repoRoot) {
  const report = readJsonArtifact(repoRoot, RAW_ARTIFACTS.knip);
  if (!report.present) {
    return report;
  }

  const payload = toRecord(report.payload) ?? {};
  const issues = Array.isArray(payload.issues) ? payload.issues : [];

  return {
    present: true,
    path: RAW_ARTIFACTS.knip,
    unusedFileCount: Array.isArray(payload.files) ? payload.files.length : 0,
    issueFileCount: issues.length,
    unusedDependencyCount: countIssueItems(issues, 'dependencies'),
    unlistedDependencyCount: countIssueItems(issues, 'unlisted'),
    unusedExportCount: countIssueItems(issues, 'exports'),
  };
}

/**
 * @param {string} repoRoot Absolute repository root used to find the bundle budget report.
 * @returns {ArtifactSummary} Summary of bundle budget route and warning counts.
 */
function summarizeBundleBudget(repoRoot) {
  const report = readJsonArtifact(repoRoot, RAW_ARTIFACTS.bundleBudget);
  if (!report.present) {
    return report;
  }

  const payload = toRecord(report.payload) ?? {};
  const largestRoute = toRecord(payload.largestFirstLoadRoute);

  return {
    present: true,
    path: RAW_ARTIFACTS.bundleBudget,
    status: typeof payload.status === 'string' ? payload.status : 'unknown',
    routeCount: readNumber(payload.routeCount),
    warningCount: countArray(payload.warnings),
    findingCount: countArray(payload.findings),
    largestFirstLoadRoute:
      typeof largestRoute?.route === 'string' ? largestRoute.route : null,
  };
}

/**
 * @param {string} repoRoot Absolute repository root used to find the strict type-check report.
 * @returns {ArtifactSummary} Summary of strict type-check status metadata.
 */
function summarizeStrictTypeCheck(repoRoot) {
  const report = readJsonArtifact(repoRoot, RAW_ARTIFACTS.strictTypeCheck);
  if (!report.present) {
    return report;
  }

  const payload = toRecord(report.payload) ?? {};

  return {
    present: true,
    path: RAW_ARTIFACTS.strictTypeCheck,
    exitCode: readNumber(payload.exitCode),
    reportPath: typeof payload.reportPath === 'string' ? payload.reportPath : null,
  };
}

/**
 * @param {string} repoRoot Absolute repository root used to find the Lighthouse manifest.
 * @returns {ArtifactSummary} Summary of Lighthouse representative run metrics.
 */
function summarizeLighthouse(repoRoot) {
  const report = readJsonArtifact(repoRoot, RAW_ARTIFACTS.lighthouse);
  if (!report.present) {
    return report;
  }

  const runs = Array.isArray(report.payload) ? report.payload : [];
  const representativeRuns = runs.filter((run) => toRecord(run)?.isRepresentativeRun === true);
  const scores = representativeRuns
    .map((run) => toRecord(toRecord(run)?.summary)?.performance)
    .filter(isFiniteNumber);

  return {
    present: true,
    path: RAW_ARTIFACTS.lighthouse,
    runCount: runs.length,
    representativeRunCount: representativeRuns.length,
    urls: representativeRuns
      .map((run) => toRecord(run)?.url)
      .filter((url) => typeof url === 'string'),
    minPerformanceScore: scores.length === 0 ? null : Math.min(...scores),
  };
}

/**
 * @param {string} repoRoot Absolute repository root containing the artifact.
 * @param {string} relativePath Repo-relative JSON artifact path.
 * @returns {{ present: false, path: string } | { present: true, path: string, payload: unknown }} Artifact presence result with parsed payload when available.
 */
function readJsonArtifact(repoRoot, relativePath) {
  const artifactPath = path.join(repoRoot, relativePath);

  if (!existsSync(artifactPath)) {
    return { present: false, path: relativePath };
  }

  return {
    present: true,
    path: relativePath,
    payload: JSON.parse(readFileSync(artifactPath, 'utf8')),
  };
}

/**
 * @param {unknown[]} issues Raw Knip issue entries to inspect.
 * @param {string} key Issue array key to count across entries.
 * @returns {number} Total item count for the requested issue key.
 */
function countIssueItems(issues, key) {
  let total = 0;

  for (const issue of issues) {
    total += countArray(toRecord(issue)?.[key]);
  }

  return total;
}

/**
 * @param {unknown} value Value that may be an array.
 * @returns {number} Array length, or zero for non-arrays.
 */
function countArray(value) {
  return Array.isArray(value) ? value.length : 0;
}

/**
 * @param {unknown} value Value that may be a finite number.
 * @returns {number | null} Finite number value, or null when unavailable.
 */
function readNumber(value) {
  return isFiniteNumber(value) ? value : null;
}

/**
 * @param {unknown} value Value to test for finite numeric type.
 * @returns {value is number} Whether the value is a finite number.
 */
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * @param {unknown} value Value to narrow to a plain object record.
 * @returns {Record<string, unknown> | null} Record view of the value, or null for non-objects.
 */
function toRecord(value) {
  return value && typeof value === 'object' ? /** @type {Record<string, unknown>} */ (value) : null;
}

/**
 * @returns {number} Process exit code for the summary command.
 */
function main() {
  const summary = summarizeQualityBaselines();
  const lines = [
    `Quality baseline summary: ${summary.outputPath}`,
    `Status: ${summary.status}`,
  ];

  for (const [name, source] of Object.entries(summary.sources)) {
    lines.push(`${name}: ${source.present ? 'present' : 'missing'}`);
  }

  console.log(lines.join('\n'));
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main();
}
