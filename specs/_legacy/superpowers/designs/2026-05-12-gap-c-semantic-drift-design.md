# Gap C Semantic Drift Contracted Table Scanner Design

Status: Approved design artifact for future implementation planning
Date: 2026-05-12

## Summary

Gap C targets a narrow documentation failure mode: a file exists, but a
source-of-truth or index table records the wrong status, path, or membership.
The first implementation should add a deterministic contracted table scanner to
`scripts/doc-gardening-check.mjs` and surface its findings through the existing
`doc:gardening` report/fix behavior.

This is not a general semantic checker. It only checks explicitly registered
Markdown tables whose contract defines the file, table identity, required
columns, accepted status values, path normalization rule, and blocking
mismatch classes. Softer semantic drift remains a Reviewer checklist concern.

## Problem

The existing doc-gardening foundation can classify `semantic-drift` findings
and protect source-of-truth paths, but it does not generate semantic findings
from Markdown content. Current checks cover freshness, workflow links, and
workflow state drift. They do not catch AGENTS or source-of-truth tables that
point at missing paths, omit required index entries, or claim the wrong status
for an existing repo file.

The useful first slice is a contracted table check:

- registered table says a path exists, but the normalized path does not exist;
- registered table omits a required path from an index/reference set;
- registered table has a status outside the contract;
- registered table has a status that contradicts deterministic repo facts, such
  as `missing` for an existing required file or `active` for a missing path.

## Non-Goals

- No LLM-style arbitrary semantic judgment.
- No attempt to prove architecture or text-vs-code reality assertions.
- No broad scan of every Markdown table in the repo.
- No inference for unregistered tables.
- No automatic rewrite of table rows, status values, or semantic content.
- No implementation in this design artifact.
- No changes to runtime product behavior, tests, CI, dependencies, or Firebase.

## Architecture

`doc:gardening` keeps one scanner pipeline inside
`scripts/doc-gardening-check.mjs`. The future implementation adds a
`tableContracts` registry and a scanner stage before report construction:

1. load table contracts;
2. read only contracted files;
3. parse Markdown tables;
4. match the configured table in each file;
5. validate columns and rows deterministically;
6. emit findings with stable codes and blocking severity;
7. pass findings through existing report/fix classification.

The registry is the only source of table semantics. A contract names the
document path, table selector, required columns, path column, status column,
allowed statuses, required paths, optional status expectations, and whether the
table is an index table or a reference/status table.

Mechanical path/status/index mismatches are blocking. Softer semantic drift,
such as whether prose still matches architecture or implementation behavior,
stays in the Reviewer checklist and is reported without auto-fix.

## Components And Data Flow

### `tableContracts`

`tableContracts` is a static registry near the checker implementation. Each
entry should include:

- `id`: stable identifier used in finding output;
- `file`: repo-relative Markdown file path;
- `table`: deterministic selector, such as heading text plus ordinal table
  under that heading;
- `requiredColumns`: exact column names after header normalization;
- `pathColumn`: column containing repo-relative paths;
- `statusColumn`: optional column containing status values;
- `allowedStatuses`: optional exact allowed status set;
- `requiredPaths`: paths that must appear in the table;
- `expectedStatuses`: optional deterministic path-to-status expectations;
- `kind`: `index`, `status`, or `reference`.

First-version contracts should cover only clearly registered tables in
`AGENTS.md` and repo source-of-truth/index/reference docs. New tables become
scannable only after being added to this registry.

### `parseMarkdownTables`

`parseMarkdownTables(content)` returns structured tables without interpreting
semantics. It should preserve source line numbers for actionable findings and
normalize only Markdown table mechanics: trimmed cell text, escaped pipe
handling when supported by the parser, and header separator detection.

The parser should not search prose for meaning. If a table is malformed enough
that it cannot be parsed according to the contract, the scanner emits a
blocking table error.

### `scanContractedTables`

`scanContractedTables({ repoRoot, contracts })` reads each contract file and
returns findings. It performs these deterministic checks:

- missing contract file;
- missing selected table;
- missing required columns;
- duplicate path rows after normalization;
- invalid path values or paths escaping the repo;
- required path missing from an index/reference table;
- row path points to a missing file when the contract requires existence;
- invalid status value;
- status mismatch against `expectedStatuses`.

Findings should include `code`, `severity`, `contractId`, `path`, `line` when
available, and a concise message. Blocking contracted-table findings should use
specific codes such as `table-contract-missing-file`,
`table-contract-missing-table`, `table-contract-missing-column`,
`table-path-mismatch`, `table-index-mismatch`, and
`table-status-mismatch`.

### CLI Behavior

`check` and default `doc:gardening` behavior should run the scanner and exit
non-zero when blocking findings exist.

`report` behavior should print the full JSON report, including contracted-table
findings, their contract id, line evidence, and whether they are blocking.

`fix` behavior must not auto-fix semantic drift or contracted table mismatches
in the first version. It may continue to apply already-allowed mechanical fixes
for unrelated metadata/link/index classes when those fixes are explicitly
implemented and source-of-truth guarded. Contracted table findings should be
reported and block completion until a human-approved Engineer edit fixes the
table.

### Reviewer Checklist Fallback

Reviewer guidance should explicitly say that the scanner only proves registered
table contracts. Reviewers still check prose and architecture claims for
semantic drift when a change touches AGENTS, source-of-truth docs, index docs,
reference docs, or workflow docs.

The checklist should ask reviewers to verify:

- new governance/index tables are either registered as contracts or explicitly
  out of scope;
- scanner findings are not suppressed by reclassifying them as report-only;
- semantic claims outside table contracts were reviewed by a human.

## Error Handling

All contracted table infrastructure errors are blocking:

- missing contract file;
- unreadable contract file;
- selected table missing;
- required columns missing;
- duplicate normalized path rows;
- invalid path syntax;
- absolute paths or paths escaping the repo;
- status missing when the contract requires it;
- status outside `allowedStatuses`;
- deterministic path/status/index mismatch.

Path normalization should use repo-relative POSIX paths. It should reject empty
paths, absolute paths, `..` escapes, and values that normalize outside the repo.
Display text may preserve the original cell value, but matching and existence
checks use the normalized path.

Semantic drift is not auto-fixed. The scanner may report deterministic
contract failures, but any correction to table content requires a human-owned
Engineer edit and Reviewer check.

## Testing

Unit tests should cover:

- valid contracted table returns no findings;
- missing contract file is blocking;
- missing selected table is blocking;
- missing required columns are blocking;
- invalid and duplicate paths are blocking;
- missing required path creates `table-index-mismatch`;
- missing repo file creates `table-path-mismatch` when existence is required;
- invalid status creates `table-status-mismatch`;
- deterministic expected-status mismatch is blocking;
- unregistered Markdown tables are ignored.

CLI integration tests should cover:

- default/check mode exits non-zero with blocking table findings;
- report mode includes contract id, code, path, line, and blocking severity;
- fix mode does not rewrite contracted table semantic findings;
- existing non-semantic auto-fix behavior remains source-of-truth guarded.

Verification commands for future implementation:

```bash
npx vitest run tests/unit/scripts/doc-gardening-check.test.mjs
node scripts/doc-gardening-check.mjs --report
node scripts/doc-gardening-check.mjs --fix
npm run lint:changed
npm run type-check:changed
git diff --check
```

Each command must be run as separate evidence. Do not combine verification with
shell chaining.

## Implementation Boundaries

Implementation must happen in a new worktree or the already assigned feature
worktree, never directly on `main`.

Repo-changing implementation is Engineer-first. The main agent may coordinate,
but must not directly implement the scanner, tests, or checklist changes.

A Reviewer subagent must inspect the same task-local diff before completion.
Reviewer evidence must cover the contract scope, scanner behavior, test output,
and the absence of unrelated edits.

The first version excludes broad architecture consistency checks and
text-vs-code reality assertions. Those remain human review items until a later
approved design defines deterministic contracts for them.

## Rollout And Closeout

Future closeout follows the repo default:

1. Engineer implements on a feature branch/worktree.
2. Reviewer passes the task-local diff.
3. Run fresh verification.
4. Stage explicit paths only.
5. Commit the reviewed change.
6. Push the feature branch.
7. Open a PR.
8. Wait for required `ci` and `e2e` checks to pass.
9. Merge on GitHub.
10. Fast-forward local `main`.

No local `main` merge fallback should be used unless explicitly requested.

## Self-Review Notes

- This design contains no unresolved marker text or unresolved open question.
- Scope is deterministic contracted table checking only.
- Unregistered Markdown tables are intentionally ignored.
- Semantic drift outside registered table contracts stays in Reviewer checklist
  fallback.
- First version excludes architecture consistency and text-vs-code reality
  assertions.
