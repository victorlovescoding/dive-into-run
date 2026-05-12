import { describe, expect, it, vi } from 'vitest';

import {
  buildReport,
  classifyFinding,
  isSourceOfTruthPath,
  runDocGardening,
} from '../../../scripts/doc-gardening-check.mjs';

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
