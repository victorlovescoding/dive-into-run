import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buildReport,
  classifyFinding,
  isSourceOfTruthPath,
  runDocGardening,
} from '../../../scripts/doc-gardening-check.mjs';

let parseMarkdownTables;
let scanContractedTables;

beforeAll(async () => {
  const scriptExports = /** @type {Record<string, unknown>} */ (
    await import('../../../scripts/doc-gardening-check.mjs')
  );
  parseMarkdownTables = scriptExports.parseMarkdownTables;
  scanContractedTables = scriptExports.scanContractedTables;
});

const AUTO_FIX_FINDING = {
  code: 'metadata-mismatch',
  path: 'docs/decisions/INDEX.md',
  message: 'Last-Verified metadata is stale.',
  fixedContent: '# Decisions\n\n> Last-Verified: 2026-05-12\n',
};

const REPORT_ONLY_FINDING = {
  code: 'semantic-drift',
  path: 'docs/automation/doc-gardening-sot.md',
  message: 'Source-of-truth summary may have drifted from implementation.',
  fixedContent: '# Refuse this write\n',
};

const TABLE_CONTRACT = {
  id: 'doc-governance-source',
  file: 'docs/automation/doc-gardening-sot.md',
  table: { heading: 'Source Of Truth Contract', ordinal: 1 },
  requiredColumns: ['Path', 'Status'],
  pathColumn: 'Path',
  statusColumn: 'Status',
  allowedStatuses: ['active', 'retired'],
  requiredPaths: ['AGENTS.md', '.codex/references/review-standards.md'],
  expectedStatuses: {
    'AGENTS.md': 'active',
    '.codex/references/review-standards.md': 'active',
  },
  requiresExistingPath: true,
  kind: 'reference',
};

const fixtureRepositoryRoots = new Set();

afterEach(() => {
  for (const repoRoot of fixtureRepositoryRoots) {
    rmSync(repoRoot, { recursive: true, force: true });
  }
  fixtureRepositoryRoots.clear();
});

/**
 * Creates a minimal temp repository fixture for contracted table scanner tests.
 * @param {{ contract?: typeof TABLE_CONTRACT, sourceContent?: string, existingPaths?: string[] }} [options] Fixture options.
 * @returns {string} Absolute temp repository root.
 */
function createFixtureRepository({
  contract = TABLE_CONTRACT,
  sourceContent,
  existingPaths = ['AGENTS.md', '.codex/references/review-standards.md'],
} = {}) {
  const repoRoot = mkdtempSync(join(tmpdir(), 'doc-gardening-check-'));
  fixtureRepositoryRoots.add(repoRoot);

  for (const path of existingPaths) {
    const absolutePath = join(repoRoot, path);
    mkdirSync(join(absolutePath, '..'), { recursive: true });
    writeFileSync(absolutePath, `${path}\n`);
  }

  if (typeof sourceContent === 'string') {
    const absoluteSourcePath = join(repoRoot, contract.file);
    mkdirSync(join(absoluteSourcePath, '..'), { recursive: true });
    writeFileSync(absoluteSourcePath, sourceContent);
  }

  return repoRoot;
}

/**
 * Builds the registered source-of-truth Markdown table around provided rows.
 * @param {string} rows Markdown table body rows.
 * @returns {string} Markdown document content.
 */
function sourceTable(rows) {
  return `# Doc Gardening

## Source Of Truth Contract

| Path | Status |
| --- | --- |
${rows}
`;
}

/**
 * Builds the common blocking finding matcher for table contract assertions.
 * @param {object} fields Expected finding fields.
 * @returns {object} Finding matcher.
 */
function blockingFinding(fields) {
  return expect.objectContaining({
    severity: 'blocking',
    blocking: true,
    contractId: 'doc-governance-source',
    path: 'docs/automation/doc-gardening-sot.md',
    ...fields,
  });
}

describe('classifyFinding', () => {
  it.each([
    ['metadata-mismatch', 'auto-fix'],
    ['link-mismatch', 'auto-fix'],
    ['index-mismatch', 'auto-fix'],
    ['semantic-drift', 'report-only'],
    ['quality-score', 'report-only'],
    ['tech-debt', 'report-only'],
    ['adr-coverage', 'report-only'],
    ['design-doc-coverage', 'report-only'],
  ])('classifies %s findings as %s', (code, mode) => {
    expect(classifyFinding({ code })).toEqual({ code, mode });
  });
});

describe('isSourceOfTruthPath', () => {
  it('never treats project-health documents as source of truth', () => {
    expect(isSourceOfTruthPath('project-health/README.md')).toBe(false);
    expect(isSourceOfTruthPath('project-health/archive/2026-05-12.md')).toBe(false);
  });

  it('recognizes AGENTS.md and Codex rules as source of truth', () => {
    expect(isSourceOfTruthPath('AGENTS.md')).toBe(true);
    expect(isSourceOfTruthPath('.codex/rules/testing-standards.md')).toBe(true);
    expect(isSourceOfTruthPath('docs/decisions/INDEX.md')).toBe(true);
  });

  it('recognizes the doc gardening source-of-truth hierarchy', () => {
    expect(isSourceOfTruthPath('docs/automation/doc-gardening-sot.md')).toBe(true);
    expect(isSourceOfTruthPath('.codex/references/review-standards.md')).toBe(true);
    expect(isSourceOfTruthPath('specs/123-feature/handoff.md')).toBe(true);
    expect(isSourceOfTruthPath('specs/123-feature/tasks.md')).toBe(true);
    expect(isSourceOfTruthPath('specs/123-feature/status.json')).toBe(true);
  });

  it('does not treat non-control spec documents as source of truth', () => {
    expect(isSourceOfTruthPath('specs/123-feature/spec.md')).toBe(false);
    expect(isSourceOfTruthPath('specs/123-feature/plan.md')).toBe(false);
  });

  it('normalizes paths before checking source-of-truth eligibility', () => {
    expect(isSourceOfTruthPath('.codex/rules/../../project-health/2026-05-12.md')).toBe(
      false
    );
    expect(isSourceOfTruthPath('.codex/rules/../rules/testing-standards.md')).toBe(true);
    expect(isSourceOfTruthPath('.codex/rules/../references/review-standards.md')).toBe(true);
    expect(isSourceOfTruthPath('specs/123-feature/../123-feature/tasks.md')).toBe(true);
  });
});

describe('buildReport', () => {
  it('returns a stable JSON report shape', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T00:00:00.000Z'));

    try {
      const report = buildReport({
        findings: [AUTO_FIX_FINDING, REPORT_ONLY_FINDING],
      });

      expect(report).toEqual({
        generatedAt: '2026-05-12T00:00:00.000Z',
        status: 'findings',
        summary: {
          total: 2,
          autoFix: 1,
          reportOnly: 1,
        },
        findings: [
          {
            code: 'metadata-mismatch',
            mode: 'auto-fix',
            path: 'docs/decisions/INDEX.md',
            message: 'Last-Verified metadata is stale.',
            hasFixedContent: true,
          },
          {
            code: 'semantic-drift',
            mode: 'report-only',
            path: 'docs/automation/doc-gardening-sot.md',
            message: 'Source-of-truth summary may have drifted from implementation.',
            hasFixedContent: true,
          },
        ],
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('runDocGardening', () => {
  it('refuses to write report-only findings even when --fix is requested', async () => {
    const writeFile = vi.fn();

    const result = await runDocGardening({
      args: ['--fix'],
      findings: [REPORT_ONLY_FINDING],
      writeFile,
    });

    expect(result).toMatchObject({
      fixedCount: 0,
      reportOnlyCount: 1,
      exitCode: 1,
    });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('refuses to write auto-fix findings outside source-of-truth paths', async () => {
    const writeFile = vi.fn();

    const result = await runDocGardening({
      args: ['--fix'],
      findings: [
        {
          code: 'metadata-mismatch',
          path: 'project-health/2026-05-12.md',
          message: 'Project health is report-only.',
          fixedContent: '# Refuse this write\n',
        },
      ],
      writeFile,
    });

    expect(result).toMatchObject({
      fixedCount: 0,
      reportOnlyCount: 0,
      exitCode: 1,
    });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('refuses path traversal outside source-of-truth paths for --fix', async () => {
    const writeFile = vi.fn();

    const result = await runDocGardening({
      args: ['--fix'],
      findings: [
        {
          code: 'metadata-mismatch',
          path: '.codex/rules/../../project-health/2026-05-12.md',
          message: 'Traversal must not write outside source of truth.',
          fixedContent: '# Refuse this write\n',
        },
      ],
      writeFile,
    });

    expect(result).toMatchObject({
      fixedCount: 0,
      reportOnlyCount: 0,
      exitCode: 1,
    });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it.each([
    [[]],
    [['--report']],
  ])('does not write files for report mode args %j', async (args) => {
    const writeFile = vi.fn();

    const result = await runDocGardening({
      args,
      findings: [AUTO_FIX_FINDING],
      writeFile,
    });

    expect(result).toMatchObject({
      fixedCount: 0,
      reportOnlyCount: 0,
      exitCode: 1,
    });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('writes only auto-fix findings with fixedContent for --fix', async () => {
    const writeFile = vi.fn();

    const result = await runDocGardening({
      args: ['--fix'],
      findings: [
        AUTO_FIX_FINDING,
        REPORT_ONLY_FINDING,
        {
          code: 'link-mismatch',
          path: 'docs/automation/doc-gardening-sot.md',
          message: 'Missing fixed content is reported, not written.',
        },
      ],
      writeFile,
    });

    expect(result).toMatchObject({
      fixedCount: 1,
      reportOnlyCount: 1,
      exitCode: 1,
    });
    expect(writeFile).toHaveBeenNthCalledWith(
      1,
      'docs/decisions/INDEX.md',
      '# Decisions\n\n> Last-Verified: 2026-05-12\n'
    );
  });

  it('writes normalized source-of-truth paths for --fix', async () => {
    const writeFile = vi.fn();

    const result = await runDocGardening({
      args: ['--fix'],
      findings: [
        {
          code: 'metadata-mismatch',
          path: '.codex/rules/../rules/testing-standards.md',
          message: 'Safe redundant segments should normalize before writing.',
          fixedContent: '# Testing\n',
        },
      ],
      writeFile,
    });

    expect(result).toMatchObject({
      fixedCount: 1,
      reportOnlyCount: 0,
      exitCode: 1,
    });
    expect(writeFile).toHaveBeenNthCalledWith(
      1,
      '.codex/rules/testing-standards.md',
      '# Testing\n'
    );
  });

  it('writes normalized source-of-truth hierarchy paths for --fix', async () => {
    const writeFile = vi.fn();

    const result = await runDocGardening({
      args: ['--fix'],
      findings: [
        {
          code: 'metadata-mismatch',
          path: '.codex/rules/../references/review-standards.md',
          message: 'Safe Codex reference paths should normalize before writing.',
          fixedContent: '# Review\n',
        },
        {
          code: 'index-mismatch',
          path: 'specs/123-feature/../123-feature/status.json',
          message: 'Safe active spec control paths should normalize before writing.',
          fixedContent: '{}\n',
        },
      ],
      writeFile,
    });

    expect(result).toMatchObject({
      fixedCount: 2,
      reportOnlyCount: 0,
      exitCode: 1,
    });
    expect(writeFile).toHaveBeenNthCalledWith(
      1,
      '.codex/references/review-standards.md',
      '# Review\n'
    );
    expect(writeFile).toHaveBeenNthCalledWith(
      2,
      'specs/123-feature/status.json',
      '{}\n'
    );
  });
});

describe('parseMarkdownTables', () => {
  it('parses markdown tables with source lines and trimmed cells', () => {
    const tables = parseMarkdownTables(`# Doc Gardening

## Source Of Truth Contract

| Path | Status |
| --- | --- |
| AGENTS.md | active |
| .codex/references/review-standards.md | active |
`);

    expect(tables).toEqual([
      expect.objectContaining({
        heading: 'Source Of Truth Contract',
        ordinal: 1,
        line: 5,
        columns: ['Path', 'Status'],
        rows: [
          expect.objectContaining({
            line: 7,
            cells: {
              Path: 'AGENTS.md',
              Status: 'active',
            },
          }),
          expect.objectContaining({
            line: 8,
            cells: {
              Path: '.codex/references/review-standards.md',
              Status: 'active',
            },
          }),
        ],
      }),
    ]);
  });

  it('ignores prose and non-table rows', () => {
    const tables = parseMarkdownTables(`# Notes

This prose mentions | pipes | but is not a table.

| Missing | Separator |

## Source Of Truth Contract

| Path | Status |
| --- | --- |
| AGENTS.md | active |

- | list | item |
`);

    expect(tables).toEqual([
      expect.objectContaining({
        heading: 'Source Of Truth Contract',
        ordinal: 1,
        line: 9,
        columns: ['Path', 'Status'],
        rows: [
          expect.objectContaining({
            line: 11,
            cells: {
              Path: 'AGENTS.md',
              Status: 'active',
            },
          }),
        ],
      }),
    ]);
  });
});

describe('scanContractedTables', () => {
  it('returns no findings for a valid contracted source table', async () => {
    const repoRoot = createFixtureRepository({
      sourceContent: sourceTable(`| AGENTS.md | active |
| .codex/references/review-standards.md | active |`),
    });

    const findings = await scanContractedTables({
      repoRoot,
      contracts: [TABLE_CONTRACT],
    });

    expect(findings).toEqual([]);
  });

  it('emits table-contract-missing-file for a missing contract file', async () => {
    const repoRoot = createFixtureRepository({ sourceContent: undefined });

    const findings = await scanContractedTables({
      repoRoot,
      contracts: [TABLE_CONTRACT],
    });

    expect(findings).toContainEqual(blockingFinding({
      code: 'table-contract-missing-file',
    }));
  });

  it('emits table-contract-missing-table for a missing selected table', async () => {
    const repoRoot = createFixtureRepository({
      sourceContent: `# Doc Gardening

## Other Table

| Path | Status |
| --- | --- |
| AGENTS.md | active |
`,
    });

    const findings = await scanContractedTables({
      repoRoot,
      contracts: [TABLE_CONTRACT],
    });

    expect(findings).toContainEqual(blockingFinding({
      code: 'table-contract-missing-table',
    }));
  });

  it('emits table-contract-missing-column for missing required columns', async () => {
    const repoRoot = createFixtureRepository({
      sourceContent: `# Doc Gardening

## Source Of Truth Contract

| Path | Owner |
| --- | --- |
| AGENTS.md | Codex |
`,
    });

    const findings = await scanContractedTables({
      repoRoot,
      contracts: [TABLE_CONTRACT],
    });

    expect(findings).toContainEqual(blockingFinding({
      code: 'table-contract-missing-column',
      line: 5,
      column: 'Status',
    }));
  });

  it('emits table-path-mismatch for invalid and duplicate path rows', async () => {
    const repoRoot = createFixtureRepository({
      sourceContent: sourceTable(`| ../secrets.md | active |
| AGENTS.md | active |
| AGENTS.md | active |
| .codex/references/review-standards.md | active |`),
    });

    const findings = await scanContractedTables({
      repoRoot,
      contracts: [TABLE_CONTRACT],
    });

    expect(findings).toContainEqual(blockingFinding({
      code: 'table-path-mismatch',
      line: 7,
      rowPath: '../secrets.md',
    }));
    expect(findings).toContainEqual(blockingFinding({
      code: 'table-path-mismatch',
      line: 9,
      rowPath: 'AGENTS.md',
    }));
  });

  it('emits table-index-mismatch when a required path is absent', async () => {
    const repoRoot = createFixtureRepository({
      sourceContent: sourceTable('| AGENTS.md | active |'),
    });

    const findings = await scanContractedTables({
      repoRoot,
      contracts: [TABLE_CONTRACT],
    });

    expect(findings).toContainEqual(blockingFinding({
      code: 'table-index-mismatch',
      requiredPath: '.codex/references/review-standards.md',
    }));
  });

  it('emits table-path-mismatch when an existing-path row points at a missing repo path', async () => {
    const repoRoot = createFixtureRepository({
      sourceContent: sourceTable(`| AGENTS.md | active |
| docs/missing.md | retired |
| .codex/references/review-standards.md | active |`),
    });

    const findings = await scanContractedTables({
      repoRoot,
      contracts: [TABLE_CONTRACT],
    });

    expect(findings).toContainEqual(blockingFinding({
      code: 'table-path-mismatch',
      line: 8,
      rowPath: 'docs/missing.md',
    }));
  });

  it('emits table-status-mismatch for invalid and unexpected statuses', async () => {
    const repoRoot = createFixtureRepository({
      sourceContent: sourceTable(`| AGENTS.md | archived |
| .codex/references/review-standards.md | retired |`),
    });

    const findings = await scanContractedTables({
      repoRoot,
      contracts: [TABLE_CONTRACT],
    });

    expect(findings).toContainEqual(blockingFinding({
      code: 'table-status-mismatch',
      line: 7,
      rowPath: 'AGENTS.md',
      status: 'archived',
    }));
    expect(findings).toContainEqual(blockingFinding({
      code: 'table-status-mismatch',
      line: 8,
      rowPath: '.codex/references/review-standards.md',
      status: 'retired',
      expectedStatus: 'active',
    }));
  });

  it('ignores unregistered markdown tables', async () => {
    const repoRoot = createFixtureRepository({
      sourceContent: `# Doc Gardening

## Source Of Truth Contract

| Path | Status |
| --- | --- |
| AGENTS.md | active |
| .codex/references/review-standards.md | active |

## Unregistered Inventory

| Path | Status |
| --- | --- |
| docs/missing.md | archived |
`,
      existingPaths: ['AGENTS.md', '.codex/references/review-standards.md'],
    });

    const findings = await scanContractedTables({
      repoRoot,
      contracts: [TABLE_CONTRACT],
    });

    expect(findings).toEqual([]);
  });
});
