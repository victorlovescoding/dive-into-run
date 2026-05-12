import {
  access as defaultAccess,
  readFile as nodeReadFile,
  writeFile as defaultWriteFile,
} from 'node:fs/promises';
import { join as pathJoin, posix as pathPosix } from 'node:path';
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

export const tableContracts = [
  {
    id: 'doc-governance-source',
    file: 'docs/automation/doc-gardening-sot.md',
    table: { heading: 'Source Of Truth Contract', ordinal: 1 },
    requiredColumns: ['Path', 'Status', 'Contract'],
    pathColumn: 'Path',
    statusColumn: 'Status',
    allowedStatuses: ['active', 'retired'],
    requiredPaths: [
      'AGENTS.md',
      'docs/automation/doc-gardening-sot.md',
      'docs/decisions/INDEX.md',
      'docs/superpowers/workflow.md',
      'docs/superpowers/task-profiles.md',
      '.codex/rules/sensors.md',
      '.codex/references/quality-gates.md',
      '.codex/references/review-standards.md',
    ],
    expectedStatuses: {
      'AGENTS.md': 'active',
      'docs/automation/doc-gardening-sot.md': 'active',
      'docs/decisions/INDEX.md': 'active',
      'docs/superpowers/workflow.md': 'active',
      'docs/superpowers/task-profiles.md': 'active',
      '.codex/rules/sensors.md': 'active',
      '.codex/references/quality-gates.md': 'active',
      '.codex/references/review-standards.md': 'active',
    },
    requiresExistingPath: true,
    kind: 'reference',
  },
];

/**
 * @typedef {{ line: number, cellsByHeader: Record<string, string>, cells: Record<string, string> }} MarkdownTableRow
 * @typedef {{ heading: string | null, ordinal: number, startLine: number, line: number, headers: string[], columns: string[], rows: MarkdownTableRow[] }} MarkdownTable
 */

/**
 * Reads UTF-8 text from a repository file.
 * @param {string} path Absolute path to read.
 * @returns {Promise<string>} File content.
 */
async function defaultReadFile(path) {
  return nodeReadFile(path, 'utf8');
}

/**
 * Checks whether a repository path exists.
 * @param {string} path Absolute path to inspect.
 * @returns {Promise<boolean>} True when the path exists.
 */
async function defaultPathExists(path) {
  try {
    await defaultAccess(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Splits a Markdown table row on unescaped pipe characters.
 * @param {string} line Markdown table line.
 * @returns {string[] | null} Parsed cells, or null when the line is not a row.
 */
function splitMarkdownTableRow(line) {
  if (!line.includes('|')) {
    return null;
  }

  const cells = [];
  let cell = '';
  let escaped = false;
  let sawSeparator = false;

  for (const character of line) {
    if (escaped) {
      if (character === '|') {
        cell += '|';
        sawSeparator = true;
      } else {
        cell += `\\${character}`;
      }
      escaped = false;
      continue;
    }

    if (character === '\\') {
      escaped = true;
      continue;
    }

    if (character === '|') {
      cells.push(cell);
      cell = '';
      sawSeparator = true;
      continue;
    }

    cell += character;
  }

  if (escaped) {
    cell += '\\';
  }

  if (!sawSeparator) {
    return null;
  }

  cells.push(cell);

  if (cells[0]?.trim() === '') {
    cells.shift();
  }

  if (cells.at(-1)?.trim() === '') {
    cells.pop();
  }

  return cells.map((value) => value.trim());
}

/**
 * Checks whether table cells form a Markdown separator row.
 * @param {string[]} cells Parsed table cells.
 * @returns {boolean} True when every cell is a Markdown table separator.
 */
function isMarkdownSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell.trim()));
}

/**
 * Extracts a Markdown heading title from one line.
 * @param {string} line Markdown source line.
 * @returns {string | null} Heading text without leading markers.
 */
function parseHeading(line) {
  const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
  return match ? match[2].trim() : null;
}

/**
 * Parses Markdown pipe tables with source line metadata.
 * @param {string} content Markdown content.
 * @returns {MarkdownTable[]} Parsed tables.
 */
export function parseMarkdownTables(content) {
  const lines = String(content).split(/\r?\n/);
  /** @type {Map<string, number>} */
  const headingTableCounts = new Map();
  /** @type {MarkdownTable[]} */
  const tables = [];
  /** @type {string | null} */
  let currentHeading = null;

  for (let index = 0; index < lines.length; index += 1) {
    const heading = parseHeading(lines[index]);

    if (heading != null) {
      currentHeading = heading;
      continue;
    }

    const headers = splitMarkdownTableRow(lines[index]);
    const separators = splitMarkdownTableRow(lines[index + 1] ?? '');

    if (
      headers == null ||
      separators == null ||
      headers.length === 0 ||
      headers.length !== separators.length ||
      !isMarkdownSeparatorRow(separators)
    ) {
      continue;
    }

    const headingKey = currentHeading ?? '';
    const ordinal = (headingTableCounts.get(headingKey) ?? 0) + 1;
    headingTableCounts.set(headingKey, ordinal);

    /** @type {MarkdownTableRow[]} */
    const rows = [];
    let rowIndex = index + 2;

    while (rowIndex < lines.length) {
      const rowCells = splitMarkdownTableRow(lines[rowIndex]);

      if (rowCells == null || rowCells.length === 0 || isMarkdownSeparatorRow(rowCells)) {
        break;
      }

      /** @type {Record<string, string>} */
      const cellsByHeader = {};

      for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
        cellsByHeader[headers[columnIndex]] = rowCells[columnIndex] ?? '';
      }

      rows.push({
        line: rowIndex + 1,
        cellsByHeader,
        cells: cellsByHeader,
      });
      rowIndex += 1;
    }

    tables.push({
      heading: currentHeading,
      ordinal,
      startLine: index + 1,
      line: index + 1,
      headers,
      columns: headers,
      rows,
    });

    index = rowIndex - 1;
  }

  return tables;
}

/**
 * Normalizes a contract path as a repo-relative POSIX path.
 * @param {unknown} value Candidate path value.
 * @returns {string | null} Normalized repo-relative path, or null when invalid.
 */
export function normalizeContractPath(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  if (trimmedValue === '' || pathPosix.isAbsolute(trimmedValue)) {
    return null;
  }

  const normalizedPath = pathPosix.normalize(trimmedValue);

  if (
    normalizedPath === '.' ||
    normalizedPath === '..' ||
    normalizedPath.startsWith('../')
  ) {
    return null;
  }

  return normalizedPath;
}

/**
 * Creates a blocking table contract finding.
 * @param {object} options Finding options.
 * @param {string} options.code Stable finding code.
 * @param {object} options.contract Table contract.
 * @param {number} [options.line] Source line when available.
 * @param {string} options.message Human-readable finding message.
 * @param {Record<string, unknown>} [options.extra] Extra structured evidence.
 * @returns {object} Blocking finding.
 */
function tableFinding({ code, contract, line, message, extra = {} }) {
  return {
    code,
    severity: 'blocking',
    blocking: true,
    contractId: contract.id,
    path: contract.file,
    ...(typeof line === 'number' ? { line } : {}),
    message,
    ...extra,
  };
}

/**
 * Finds the registered table selected by a contract.
 * @param {ReturnType<typeof parseMarkdownTables>} tables Parsed Markdown tables.
 * @param {object} contract Table contract.
 * @returns {ReturnType<typeof parseMarkdownTables>[number] | undefined} Matching table.
 */
function findContractTable(tables, contract) {
  const selector = contract.table ?? {};
  const ordinal = selector.ordinal ?? 1;

  return tables.find((table) => {
    if (typeof selector.heading === 'string' && table.heading !== selector.heading) {
      return false;
    }

    return table.ordinal === ordinal;
  });
}

/**
 * Scans explicitly registered Markdown table contracts.
 * @param {{ repoRoot?: string, contracts?: Array<object>, readFile?: (path: string) => Promise<string>, pathExists?: (path: string) => Promise<boolean> }} [options] Scanner options.
 * @returns {Promise<Array<object>>} Blocking contract findings.
 */
export async function scanContractedTables({
  repoRoot = process.cwd(),
  contracts = tableContracts,
  readFile = defaultReadFile,
  pathExists = defaultPathExists,
} = {}) {
  const findings = [];

  for (const contract of contracts) {
    const contractFile = normalizeContractPath(contract.file);

    if (contractFile == null) {
      findings.push(
        tableFinding({
          code: 'table-contract-missing-file',
          contract,
          message: `Contract file path is invalid: ${String(contract.file)}`,
        })
      );
      continue;
    }

    let content;

    try {
      content = await readFile(pathJoin(repoRoot, contractFile));
    } catch {
      findings.push(
        tableFinding({
          code: 'table-contract-missing-file',
          contract,
          message: `Contract file is missing: ${contract.file}`,
        })
      );
      continue;
    }

    const table = findContractTable(parseMarkdownTables(content), contract);

    if (table == null) {
      findings.push(
        tableFinding({
          code: 'table-contract-missing-table',
          contract,
          message: `Contract table is missing in ${contract.file}`,
        })
      );
      continue;
    }

    let hasMissingColumn = false;

    for (const column of contract.requiredColumns ?? []) {
      if (!table.headers.includes(column)) {
        hasMissingColumn = true;
        findings.push(
          tableFinding({
            code: 'table-contract-missing-column',
            contract,
            line: table.startLine,
            message: `Contract table is missing required column: ${column}`,
            extra: { column },
          })
        );
      }
    }

    if (hasMissingColumn) {
      continue;
    }

    const requiredPaths = Array.isArray(contract.requiredPaths)
      ? contract.requiredPaths
          .map((requiredPath) => normalizeContractPath(requiredPath))
          .filter((requiredPath) => requiredPath != null)
      : [];
    const requiredPathSet = new Set(requiredPaths);
    const requiresExactPaths = Array.isArray(contract.requiredPaths);
    const requiresContractColumn = contract.requiredColumns?.includes('Contract');
    const seenPaths = new Set();

    for (const row of table.rows) {
      const rowPath = row.cellsByHeader[contract.pathColumn];
      const normalizedPath = normalizeContractPath(rowPath);

      if (normalizedPath == null) {
        findings.push(
          tableFinding({
            code: 'table-path-mismatch',
            contract,
            line: row.line,
            message: `Contract table row has an invalid path: ${rowPath}`,
            extra: { rowPath },
          })
        );
        continue;
      }

      if (seenPaths.has(normalizedPath)) {
        findings.push(
          tableFinding({
            code: 'table-path-mismatch',
            contract,
            line: row.line,
            message: `Contract table row duplicates path: ${normalizedPath}`,
            extra: { rowPath },
          })
        );
        continue;
      }

      seenPaths.add(normalizedPath);

      if (requiresExactPaths && !requiredPathSet.has(normalizedPath)) {
        findings.push(
          tableFinding({
            code: 'table-index-mismatch',
            contract,
            line: row.line,
            message: `Contract table row is not registered as a required path: ${normalizedPath}`,
            extra: { rowPath: normalizedPath },
          })
        );
      }

      if (
        contract.requiresExistingPath === true &&
        !(await pathExists(pathJoin(repoRoot, normalizedPath)))
      ) {
        findings.push(
          tableFinding({
            code: 'table-path-mismatch',
            contract,
            line: row.line,
            message: `Contract table row points at a missing repo path: ${normalizedPath}`,
            extra: { rowPath },
          })
        );
      }

      const status = row.cellsByHeader[contract.statusColumn];

      if (
        Array.isArray(contract.allowedStatuses) &&
        !contract.allowedStatuses.includes(status)
      ) {
        findings.push(
          tableFinding({
            code: 'table-status-mismatch',
            contract,
            line: row.line,
            message: `Contract table row has invalid status: ${status}`,
            extra: { rowPath: normalizedPath, status },
          })
        );
      }

      const expectedStatus = contract.expectedStatuses?.[normalizedPath];

      if (typeof expectedStatus === 'string' && status !== expectedStatus) {
        findings.push(
          tableFinding({
            code: 'table-status-mismatch',
            contract,
            line: row.line,
            message: `Contract table row status for ${normalizedPath} must be ${expectedStatus}`,
            extra: { rowPath: normalizedPath, status, expectedStatus },
          })
        );
      }

      if (requiresContractColumn) {
        const contractValue = row.cellsByHeader.Contract;

        if (contractValue !== contract.id) {
          findings.push(
            tableFinding({
              code: 'table-contract-mismatch',
              contract,
              line: row.line,
              message: `Contract table row for ${normalizedPath} must name contract ${contract.id}`,
              extra: {
                rowPath: normalizedPath,
                contractValue,
                expectedContract: contract.id,
              },
            })
          );
        }
      }
    }

    for (const normalizedRequiredPath of requiredPaths) {
      if (!seenPaths.has(normalizedRequiredPath)) {
        findings.push(
          tableFinding({
            code: 'table-index-mismatch',
            contract,
            message: `Contract table is missing required path: ${normalizedRequiredPath}`,
            extra: { requiredPath: normalizedRequiredPath },
          })
        );
      }
    }
  }

  return findings;
}

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
    const reportFinding = {
      code: classification.code,
      mode: classification.mode,
      path: finding.path,
      message: finding.message,
      hasFixedContent: typeof finding.fixedContent === 'string',
    };

    if (typeof finding.severity === 'string') {
      reportFinding.severity = finding.severity;
    }

    if (typeof finding.blocking === 'boolean') {
      reportFinding.blocking = finding.blocking;
    }

    if (typeof finding.contractId === 'string') {
      reportFinding.contractId = finding.contractId;
    }

    if (typeof finding.line === 'number') {
      reportFinding.line = finding.line;
    }

    return reportFinding;
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
 * @param {{ args?: string[], findings?: Array<object>, repoRoot?: string, contracts?: Array<object>, readFile?: (path: string) => Promise<string>, pathExists?: (path: string) => Promise<boolean>, writeFile?: (path: string, content: string) => Promise<unknown>, scanTables?: (options: { repoRoot: string, contracts: Array<object>, readFile: (path: string) => Promise<string>, pathExists: (path: string) => Promise<boolean> }) => Promise<Array<object>> }} [options] Runtime options.
 * @returns {Promise<object>} Report, fix counts, and process exit code.
 */
export async function runDocGardening({
  args = [],
  findings,
  repoRoot = process.cwd(),
  contracts = tableContracts,
  readFile = defaultReadFile,
  pathExists = defaultPathExists,
  writeFile = defaultWriteFile,
  scanTables = scanContractedTables,
} = {}) {
  const shouldFix = args.includes('--fix');
  const resolvedFindings = Array.isArray(findings)
    ? findings
    : await scanTables({ repoRoot, contracts, readFile, pathExists });
  const report = buildReport({ findings: resolvedFindings });
  let fixedCount = 0;

  if (shouldFix) {
    for (const finding of resolvedFindings) {
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
