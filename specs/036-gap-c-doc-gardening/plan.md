# Gap C Doc-Gardening MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add minimal doc-review and doc-freshness controls without touching product behavior.

**Architecture:** This is a docs-and-gates feature. The source of truth is repo markdown metadata plus one shell checker; `package.json` and CI only expose the same checker in local and pull-request workflows.

**Tech Stack:** Markdown, POSIX shell/Bash, npm scripts, GitHub Actions.

---

## Summary

The MVP has three deliverables after this planning seed:

- A minimal review checklist at `.codex/references/review-standards.md`.
- Freshness metadata on a small key-doc set.
- One script, one package script, and one CI step that enforce metadata presence, date shape, and a 45-day stale threshold.

No production source, executable tests, dependencies, Firebase rules, or broad doc rewrites are part of this plan.

## Architecture

- Freshness metadata is stored inside each tracked markdown document as a visible header line, using the exact key `Last-Verified`.
- The freshness checker is a repo-local shell script with a hard-coded MVP file list so it is deterministic, reviewable, and does not accidentally expand scope to every markdown file.
- The freshness checker fails when a tracked file is missing metadata, has a malformed date, or has a `Last-Verified` date older than 45 days relative to the current local date.
- The checker supports `DOC_FRESHNESS_ROOT` as an optional root override so negative-path verification can mutate a temporary copy instead of the working tree.
- The npm script delegates to the shell script. CI delegates to the same npm script so local and remote behavior stay aligned.
- Review standards stay as a reference document; they should point to existing quality gates instead of copying full rule bodies from `.codex/references/quality-gates.md`.

## Files And Responsibilities

| Path | Action | Responsibility |
| ---- | ------ | -------------- |
| `specs/036-gap-c-doc-gardening/spec.md` | Create | Product intent, requirements, success criteria, and explicit non-goals. |
| `specs/036-gap-c-doc-gardening/plan.md` | Create | Technical approach, file responsibilities, verification strategy, risks, and task slices. |
| `specs/036-gap-c-doc-gardening/tasks.md` | Create | Human-readable task board with Engineer/Reviewer pairs and evidence slots. |
| `specs/036-gap-c-doc-gardening/handoff.md` | Create | Current state and next-session read order. |
| `specs/036-gap-c-doc-gardening/status.json` | Create | Machine-readable dispatcher state. |
| `.codex/references/review-standards.md` | Create | Minimal review checklist and PASS/REJECT evidence contract. |
| `AGENTS.md` | Modify | Add or update `Last-Verified` metadata if missing or stale. |
| `docs/superpowers/workflow.md` | Modify | Add or update `Last-Verified` metadata if missing or stale. |
| `.codex/references/quality-gates.md` | Modify | Add or update `Last-Verified` metadata if missing or stale. |
| `.codex/references/testing-handbook.md` | Modify | Add or update `Last-Verified` metadata if missing or stale. |
| `docs/QUALITY_SCORE.md` | Modify | Normalize freshness metadata while preserving existing review/date semantics. |
| `scripts/doc-freshness-check.sh` | Create | Check that the MVP key-doc set contains valid and non-stale `Last-Verified` metadata. |
| `package.json` | Modify | Add `doc:freshness` script that runs the checker. |
| `.github/workflows/ci.yml` | Modify | Run `npm run doc:freshness` in the CI job. |

## Key Documentation Set

The MVP freshness checker must track exactly this initial set:

- `AGENTS.md`
- `docs/superpowers/workflow.md`
- `.codex/references/quality-gates.md`
- `.codex/references/testing-handbook.md`
- `.codex/references/review-standards.md`
- `docs/QUALITY_SCORE.md`

Do not add every file under `.codex/references/` in this MVP. The harness article summaries are useful references but are not part of the approved minimal freshness gate.

## Metadata Contract

Use this line format in each tracked markdown file:

```markdown
> Last-Verified: YYYY-MM-DD
```

The freshness script should accept only ISO calendar dates in that exact shape. It must verify presence, date shape, and freshness.
The freshness script must fail when the date is more than 45 days before the check date.

The script must also support this optional environment variable:

| Variable | Meaning |
| -------- | ------- |
| `DOC_FRESHNESS_ROOT` | Repository-like root to inspect instead of `pwd`; used only for temp-copy negative-path verification. |

## Testing Strategy

- Required reference before test work: `.codex/references/testing-handbook.md` only if an implementation task adds executable tests. This MVP plan does not require executable tests.
- RED target: run `DOC_FRESHNESS_ROOT="$tmpdir" bash scripts/doc-freshness-check.sh` against a temporary copy where one tracked file has no `Last-Verified`; expected signal is non-zero exit and a message naming the missing file.
- Stale target: run the same checker against a temporary copy where one tracked file has a `Last-Verified` value 46 days in the past; expected signal is non-zero exit and a message naming the stale file and threshold.
- GREEN target: run `bash scripts/doc-freshness-check.sh` after metadata is present; expected signal is exit 0.
- Regression coverage: shell-script behavior is covered by direct command execution, not Vitest, because the checker is small, deterministic, and has no JavaScript runtime boundary.
- Integration coverage: run `npm run doc:freshness` after adding the package script and run the CI-equivalent command locally before final handoff.

## Risk And Stop Conditions

- Stop if the implementation requires changing production code, tests, Firebase rules, lockfiles, dependencies, or broad unrelated docs.
- Stop if the desired key-doc list expands beyond the MVP set above; that changes scope and checker semantics.
- Stop if `docs/QUALITY_SCORE.md` date fields conflict with the new `Last-Verified` metadata and the correct meaning is unclear.
- Stop if CI structure changes underneath this branch and the insertion point for doc freshness is ambiguous.
- Stop if the stale threshold needs to change from 45 days, because that is a policy decision outside implementation mechanics.

## Task Slices

- T001: Planning seed verification.
- T002: Review-standards minimal reference doc.
- T003: Last-Verified metadata on key docs.
- T004: Doc freshness script plus package script.
- T005: CI integration plus local verification.
- T006: Final docs update and handoff.
