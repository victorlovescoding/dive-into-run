# Gap C Doc-Gardening MVP Spec

## Summary

Create a minimal documentation-gardening workflow so key engineering references stay reviewable, freshness metadata is visible, and stale docs fail early in local and CI gates.

This MVP closes the current documentation control gap without changing product behavior, executable tests, Firebase rules, or runtime architecture.

## User Scenarios

- As a reviewer, I can open one review-standards reference and know the minimum review checklist expected before a task is accepted.
- As an engineer, I can see when key project documents were last verified and which command is responsible for checking freshness.
- As a coordinator, I can assign documentation freshness work as small Engineer + Reviewer slices with clear ownership and verification evidence.
- As a maintainer, I can rely on local and CI checks to catch missing freshness metadata before stale docs drift silently.

## Requirements

- R1: Provide a minimal `.codex/references/review-standards.md` that defines the baseline code-review checklist and PASS/REJECT evidence expectations.
- R2: Add `Last-Verified` metadata to the agreed key documentation set so each file exposes a concrete freshness signal.
- R3: Provide a local documentation freshness check command that detects missing, invalid, or stale freshness metadata in the agreed key documentation set.
- R4: Wire the freshness check into the package script surface and CI so it can run locally and on pull requests.
- R5: Keep the MVP documentation-only and non-invasive: no product behavior changes, no production code changes, no executable test changes, no dependency changes.
- R6: Preserve the Superpowers workflow contract: every implementation slice has an Engineer, Reviewer, owned files, verification commands, acceptance criteria, and a commit checkpoint.
- R7: Treat `Last-Verified` dates older than 45 days as stale and failing.

## Success Criteria

- SC1: The review standards reference exists and gives reviewers a usable minimum checklist without duplicating every existing quality-gate rule.
- SC2: The agreed key docs include explicit `Last-Verified` metadata with dates that can be checked mechanically.
- SC3: Running the documentation freshness check exits non-zero when required metadata is missing, malformed, or older than 45 days, and exits zero when all tracked docs satisfy the rule.
- SC4: `npm run doc:freshness` is available and CI runs the same freshness check before merge.
- SC5: The final handoff identifies latest verification evidence, remaining risks, and the next owner action.

## Out Of Scope

- Rewriting existing engineering references beyond the minimal review-standards MVP.
- Changing application source code under `src/`, executable tests under `tests/`, Firebase rules, database schema, or user-facing behavior.
- Introducing new npm dependencies or formatting tools.
- Building a large documentation portal, generated docs site, or broad content taxonomy.
- Enforcing freshness for every markdown file in the repository during the MVP.

## User Authorization

- Spec approved by: user, before this planning seed on 2026-05-10.
- One-time automated execution authorization: no. This worker only initializes workflow artifacts for later sessions.
