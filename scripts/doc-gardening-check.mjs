import { writeFile as defaultWriteFile } from 'node:fs/promises';
import { posix as pathPosix } from 'node:path';
import { fileURLToPath } from 'node:url';

const AUTO_FIX_CODES = new Set([
  'metadata-mismatch',
  'link-mismatch',
  'index-mismatch',
]);

const REPORT_ONLY_CODES = new Set([
  'semantic-drift',
  'quality-score',
  'tech-debt',
  'adr-coverage',
  'design-doc-coverage',
]);

const SOURCE_OF_TRUTH_FILES = new Set([
  'AGENTS.md',
  'docs/automation/doc-gardening-sot.md',
  'docs/decisions/INDEX.md',
]);

const SOURCE_OF_TRUTH_PREFIXES = ['.codex/rules/', '.codex/references/'];

const SPEC_CONTROL_FILES = new Set(['handoff.md', 'tasks.md', 'status.json']);

/**
 * Classifies a doc-gardening finding by its remediation mode.
 * @param {{ code?: string } | null | undefined} finding Finding to classify.
 * @returns {{ code: string | undefined, mode: 'auto-fix' | 'report-only' }} Classification result.
 */
export function classifyFinding(finding) {
  const code = finding?.code;

  if (AUTO_FIX_CODES.has(code)) {
    return { code, mode: 'auto-fix' };
  }

  if (REPORT_ONLY_CODES.has(code)) {
    return { code, mode: 'report-only' };
  }

  return { code, mode: 'report-only' };
}

/**
 * Normalizes a repo-relative POSIX path and rejects paths outside the repo.
 * @param {string} path Path to normalize.
 * @returns {string | null} Normalized relative path, or null when invalid.
 */
function normalizeRelativePath(path) {
  if (typeof path !== 'string' || pathPosix.isAbsolute(path)) {
    return null;
  }

  const normalizedPath = pathPosix.normalize(path);

  if (normalizedPath === '..' || normalizedPath.startsWith('../')) {
    return null;
  }

  return normalizedPath;
}

/**
 * Checks whether a path is an allowed source-of-truth documentation file.
 * @param {string} path Repo-relative path to inspect.
 * @returns {boolean} True when the path is managed as source-of-truth docs.
 */
export function isSourceOfTruthPath(path) {
  const normalizedPath = normalizeRelativePath(path);

  if (normalizedPath?.startsWith('project-health/')) {
    return false;
  }

  if (normalizedPath == null) {
    return false;
  }

  if (SOURCE_OF_TRUTH_FILES.has(normalizedPath)) {
    return true;
  }

  if (SOURCE_OF_TRUTH_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))) {
    return true;
  }

  const [specsDirectory, featureDirectory, fileName, ...extraSegments] =
    normalizedPath.split('/');

  return (
    specsDirectory === 'specs' &&
    typeof featureDirectory === 'string' &&
    featureDirectory.length > 0 &&
    extraSegments.length === 0 &&
    SPEC_CONTROL_FILES.has(fileName)
  );
}

/**
 * Builds a serializable doc-gardening report from raw findings.
 * @param {{ findings?: Array<object> }} [options] Report input.
 * @returns {object} Report payload with summary counts and findings.
 */
export function buildReport({ findings = [] } = {}) {
  const reportFindings = findings.map((finding) => {
    const classification = classifyFinding(finding);

    return {
      code: classification.code,
      mode: classification.mode,
      path: finding.path,
      message: finding.message,
      hasFixedContent: typeof finding.fixedContent === 'string',
    };
  });

  const autoFix = reportFindings.filter((finding) => finding.mode === 'auto-fix').length;
  const reportOnly = reportFindings.filter((finding) => finding.mode === 'report-only').length;

  return {
    generatedAt: new Date().toISOString(),
    status: reportFindings.length > 0 ? 'findings' : 'clean',
    summary: {
      total: reportFindings.length,
      autoFix,
      reportOnly,
    },
    findings: reportFindings,
  };
}

/**
 * Runs doc gardening and optionally writes auto-fixable source-of-truth files.
 * @param {{ args?: string[], findings?: Array<object>, writeFile?: (path: string, content: string) => Promise<unknown> }} [options] Runtime options.
 * @returns {Promise<object>} Report, fix counts, and process exit code.
 */
export async function runDocGardening({
  args = [],
  findings = [],
  writeFile = defaultWriteFile,
} = {}) {
  const shouldFix = args.includes('--fix');
  const report = buildReport({ findings });
  let fixedCount = 0;

  if (shouldFix) {
    for (const finding of findings) {
      const classification = classifyFinding(finding);

      if (
        classification.mode === 'auto-fix' &&
        typeof finding.fixedContent === 'string' &&
        isSourceOfTruthPath(finding.path)
      ) {
        await writeFile(normalizeRelativePath(finding.path), finding.fixedContent);
        fixedCount += 1;
      }
    }
  }

  return {
    report,
    fixedCount,
    reportOnlyCount: report.summary.reportOnly,
    exitCode: report.summary.total > 0 ? 1 : 0,
  };
}

/**
 * Executes the CLI entrypoint and writes the JSON report to stdout.
 * @returns {Promise<void>} Resolves after the report is written.
 */
async function main() {
  const result = await runDocGardening({
    args: process.argv.slice(2),
    findings: [],
  });

  process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
  process.exitCode = result.exitCode;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
