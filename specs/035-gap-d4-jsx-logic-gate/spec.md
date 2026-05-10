# Feature Specification: Gap D4 JSX Logic Gate

**Feature Branch**: `035-gap-d4-jsx-logic-gate`
**Created**: 2026-05-10
**Status**: Draft
**Input**: User confirmed Gap D4 option A: D4-MVP gate.

## Scope

Gap D4 remains open because `No logic in JSX` is still enforced mostly by manual review. This feature adds a mechanical lint gate for the high-confidence, low-false-positive subset of JSX logic patterns that should not appear in render markup.

This is an MVP gate. It does not claim the full D4 problem is finished, and it does not include a cleanup of the existing `react/jsx-no-leaked-render` findings.

## Background

The D4 source note came from the main checkout's ignored `project-health/2026-04-24-openai-harness-gap-analysis.md` snapshot. That file is not expected to exist in this worktree because `project-health/` is ignored and not part of the tracked tree.

The relevant facts are self-contained here:

- D4 is still open / unverified.
- `No logic in JSX` exists as a written coding rule, but does not yet have an equivalent mechanical gate for the selected MVP subset.
- This feature only creates the selected high-confidence JSX logic gate.
- This feature does not mean D4 is fully done.

## User Scenarios & Testing

### User Story 1 - Agent gets blocked when adding obvious JSX logic (Priority: P1)

As a maintainer, I want lint to reject obviously complex JSX expressions so future agents do not rely on memory or reviewer taste to follow `No logic in JSX`.

**Why this priority**: The rule already exists in `.codex/rules/coding-rules.md`, but a written rule is weak when agents modify JSX without checking the guide. A mechanical gate turns the most obvious violations into immediate feedback.

**Independent Test**: Add a temporary fixture or probe containing a blocked JSX pattern, run ESLint, and confirm the configured rule fails with a remediation message. Revert the probe before commit.

**Acceptance Scenarios**:

1. **Given** a JSX file contains an IIFE inside JSX, **When** ESLint runs, **Then** lint fails and tells the engineer to move logic outside JSX.
2. **Given** a JSX file contains a nested ternary inside JSX, **When** ESLint runs, **Then** lint fails and points to simpler render state preparation.
3. **Given** a JSX file calls `filter`, `reduce`, `sort`, or `toSorted` inside JSX, **When** ESLint runs, **Then** lint fails and points to precomputed values.
4. **Given** a JSX file maps with a block-bodied callback inside JSX, **When** ESLint runs, **Then** lint fails and points to extracting the callback or render component.
5. **Given** a JSX file uses conditional object spread inside JSX, **When** ESLint runs, **Then** lint fails and points to preparing props or style objects before JSX.

### User Story 2 - Reviewer can trust the MVP boundary (Priority: P1)

As a reviewer, I want this feature to make only narrow, high-confidence claims so the project does not pretend the entire D4 rule is solved.

**Why this priority**: Overclaiming would hide remaining JSX review debt. The MVP should improve enforcement without creating a false sense of completion.

**Independent Test**: Review the spec, plan, ESLint messages, and any follow-up docs for wording that labels D4 as complete. The wording must say MVP or partial gate.

**Acceptance Scenarios**:

1. **Given** this feature lands, **When** project health is discussed, **Then** D4 is described as partially mechanized by a D4-MVP gate, not fully closed.
2. **Given** `react/jsx-no-leaked-render` has existing findings, **When** this feature lands, **Then** those findings are not included in this task scope.

### User Story 3 - Legal out-of-scope JSX remains allowed (Priority: P1)

As a reviewer, I want a smoke test that proves common legal JSX patterns still pass lint so the MVP gate does not accidentally expand beyond the approved high-confidence subset.

**Why this priority**: The MVP is useful only if it blocks obvious render logic without turning normal declarative JSX into lint churn.

**Independent Test**: Add a temporary fixture or probe containing legal out-of-scope JSX patterns, run ESLint, and confirm the configured rule passes. Revert the probe before commit.

**Acceptance Scenarios**:

1. **Given** a JSX file contains a single ternary expression, **When** ESLint runs, **Then** the D4-MVP gate does not fail on that pattern.
2. **Given** a JSX file maps with an expression-bodied callback, **When** ESLint runs, **Then** the D4-MVP gate does not fail on that pattern.
3. **Given** a JSX file spreads a prepared props object, **When** ESLint runs, **Then** the D4-MVP gate does not fail on that pattern.
4. **Given** a JSX file uses a simple JSX prop spread, **When** ESLint runs, **Then** the D4-MVP gate does not fail on that pattern.

## Requirements

### Functional Requirements

- **FR-001**: The gate MUST lint `src/**/*.{js,jsx}` JSX files for a narrow high-confidence subset of `No logic in JSX`.
- **FR-002**: The gate MUST block IIFEs inside JSX expression containers.
- **FR-003**: The gate MUST block nested ternary expressions inside JSX expression containers.
- **FR-004**: The gate MUST block `filter`, `reduce`, `sort`, and `toSorted` calls inside JSX expression containers.
- **FR-005**: The gate MUST block block-bodied `map` callbacks inside JSX expression containers.
- **FR-006**: The gate MUST block conditional object spread inside JSX props or JSX expression containers.
- **FR-007**: Each lint failure MUST include a remediation message that tells the agent what to do instead of only naming the syntax.
- **FR-008**: The implementation MUST preserve existing mechanical lint gates for tests and other quality rules.
- **FR-009**: The gate MUST allow legal out-of-scope JSX patterns including single ternary expressions, expression-bodied `map` callbacks, prepared props spread, and simple JSX prop spread.
- **FR-010**: The feature MUST NOT modify production behavior, test behavior, or runtime configuration.
- **FR-011**: The feature MUST NOT include cleanup of existing `react/jsx-no-leaked-render` findings.
- **FR-012**: The feature MUST NOT claim complete D4 closure.

### Non-Goals

- Cleaning the existing `react/jsx-no-leaked-render` backlog.
- Building a custom ESLint plugin in this MVP.
- Detecting every possible form of render logic.
- Refactoring existing JSX logic unless it is required to retire a baseline for the MVP gate.

## Key Concepts

- **D4-MVP gate**: A mechanical lint gate for the most obvious and lowest-noise JSX logic patterns.
- **High-confidence subset**: Patterns that are almost always better prepared before JSX or extracted into a helper/component.
- **Remediation message**: ESLint message written as agent context, describing how to fix the violation.

## Success Criteria

- **SC-001**: ESLint fails on each in-scope JSX logic pattern with a clear remediation message.
- **SC-002**: ESLint passes a negative smoke probe containing legal out-of-scope JSX patterns.
- **SC-003**: Existing mechanical lint gates still work after this feature lands.
- **SC-004**: No production, test, or runtime behavior changes are introduced.
- **SC-005**: `npx eslint src specs` completes with expected results after implementation and any required MVP baseline handling.
- **SC-006**: The final documentation and closeout describe D4 as an MVP/partial gate, not complete D4 closure.
