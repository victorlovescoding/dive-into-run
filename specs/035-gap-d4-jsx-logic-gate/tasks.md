# Tasks: Gap D4 JSX Logic Gate

**Source**: `specs/035-gap-d4-jsx-logic-gate/spec.md`
**Plan**: `specs/035-gap-d4-jsx-logic-gate/plan.md`
**Scope**: D4-MVP gate only. Do not claim full D4 closure. Do not include `react/jsx-no-leaked-render` cleanup.

---

## Execution Contract

Every task needs an Engineer and Reviewer. A checkbox is done only after the Reviewer accepts the diff and verification evidence.

The main agent coordinates and reports status. Engineers and Reviewers should not revert unrelated work from other agents or worktrees.

The D4 background is self-contained in `spec.md` and `plan.md`. Do not copy `project-health/` into this worktree; the original D4 note came from an ignored snapshot in the main checkout.

## Shared Acceptance Criteria

- The D4-MVP gate blocks only the approved high-confidence subset:
  - JSX IIFE
  - nested ternary inside JSX
  - JSX-local `filter`, `reduce`, `sort`, `toSorted`
  - block-bodied `map` callback inside JSX
  - conditional object spread inside JSX props or JSX expression containers
- Existing test-specific `no-restricted-syntax` gates remain intact.
- Error messages tell the agent how to fix the pattern.
- No production behavior, test behavior, or runtime config changes are introduced.
- No temporary lint probe remains in the final diff.
- Reviewer PASS requires positive smoke evidence that in-scope patterns fail and negative smoke evidence that legal out-of-scope JSX passes.
- Closeout wording says D4-MVP / partial gate, not full D4 completion.
- No task depends on `project-health/` existing in this worktree.

---

## T0 — Planning Docs

**Engineer**: Planning Engineer
**Reviewer**: Planning Reviewer
**Owned files**:

- `specs/035-gap-d4-jsx-logic-gate/spec.md`
- `specs/035-gap-d4-jsx-logic-gate/plan.md`
- `specs/035-gap-d4-jsx-logic-gate/tasks.md`

**Dependencies**: User confirmation that Gap D4 uses option A: D4-MVP gate.

- [x] **T0.1 Write spec**
  - Engineer: write WHAT/WHY, user scenarios, requirements, non-goals, and success criteria only.
  - Reviewer: confirm `spec.md` has no ESLint selector implementation detail and does not claim full D4 closure.

- [x] **T0.2 Write plan**
  - Engineer: document technical approach, target file, exact ESLint selectors, verification order, and risk management.
  - Reviewer: confirm selector list matches user-approved MVP scope and excludes `react/jsx-no-leaked-render` cleanup.

- [x] **T0.3 Write task queue**
  - Engineer: split execution into checkbox tasks with Engineer + Reviewer, owned files, dependencies, acceptance criteria, verification commands, and commit checkpoints.
  - Reviewer: confirm tasks are executable in order and do not require production/test/config edits during planning.

**Acceptance criteria**:

- [x] The three docs exist.
- [x] Only the three docs are changed for the planning task.
- [x] `spec.md` stays WHAT/WHY only and includes both positive and negative smoke acceptance.
- [x] `plan.md` contains selectors and positive/negative smoke verification.
- [x] `tasks.md` contains Engineer + Reviewer gates for both positive and negative smoke.
- [x] The docs are self-contained and do not require copying ignored `project-health/`.

**Verification commands**:

```bash
git status --short
git diff -- specs/035-gap-d4-jsx-logic-gate/spec.md specs/035-gap-d4-jsx-logic-gate/plan.md specs/035-gap-d4-jsx-logic-gate/tasks.md
```

**Commit checkpoint**:

```bash
git add specs/035-gap-d4-jsx-logic-gate/spec.md specs/035-gap-d4-jsx-logic-gate/plan.md specs/035-gap-d4-jsx-logic-gate/tasks.md
git commit -m "docs: plan jsx logic lint gate"
```

---

## T1 — ESLint Gate Implementation

**Engineer**: ESLint Engineer
**Reviewer**: Lint Reviewer
**Owned files**:

- `eslint.config.mjs`

**Dependencies**: T0 complete and approved.

- [x] **T1.1 Add source-only D4-MVP block**
  - Engineer: add a `src/**/*.{js,jsx}` flat-config block with `no-restricted-syntax` selectors from `plan.md`.
  - Reviewer: confirm the block does not overlap `tests/**` and does not replace existing test-specific `no-restricted-syntax` arrays.

- [x] **T1.2 Selector parse check**
  - Engineer: run selector parse verification.
  - Reviewer: confirm any lint output is a real violation or documented selector issue, not config breakage.

**Acceptance criteria**:

- [x] The new block is scoped to `src/**/*.{js,jsx}`.
- [x] All in-scope selectors are present or replaced with tested equivalents.
- [x] Messages contain remediation guidance.
- [x] No existing test blocks are removed or weakened.

**Verification commands**:

```bash
npx eslint src --no-error-on-unmatched-pattern
npx eslint tests/integration/**/*.test.jsx --no-error-on-unmatched-pattern
```

**Commit checkpoint**:

```bash
git add eslint.config.mjs
git commit -m "chore: add jsx logic lint gate"
```

---

## T2 — Positive Smoke Probe

**Engineer**: Verification Engineer
**Reviewer**: Verification Reviewer
**Owned files**:

- Temporary probe under `src/**` only while testing

**Dependencies**: T1 complete.

- [x] **T2.1 Create temporary probe**
  - Engineer: create a temporary JSX file containing each blocked MVP pattern.
  - Reviewer: confirm the probe covers all five approved categories and no extra categories.

- [x] **T2.2 Run lint against probe**
  - Engineer: run ESLint against the probe and capture the D4-MVP errors.
  - Reviewer: confirm lint errors include remediation messages.

- [x] **T2.3 Remove probe**
  - Engineer: delete/revert the temporary probe.
  - Reviewer: confirm `git status --short` has no probe file.

**Acceptance criteria**:

- [x] Every MVP pattern is proven to fail lint.
- [x] The temporary probe is removed before commit.
- [x] No production/test/config behavior changes come from the probe.

**Verification commands**:

```bash
npx eslint src/path/to/d4-positive-probe.jsx
git status --short
```

**Commit checkpoint**:

No commit for the probe. It must not remain in the final diff.

---

## T3 — Negative Smoke Probe

**Engineer**: Verification Engineer
**Reviewer**: Verification Reviewer
**Owned files**:

- Temporary probe under `src/**` only while testing

**Dependencies**: T1 complete. Run after or alongside T2, but Reviewer PASS requires evidence from both T2 and T3.

- [x] **T3.1 Create temporary legal probe**
  - Engineer: create a temporary JSX file containing legal out-of-scope patterns: single ternary, expression-bodied `map`, prepared props spread, and simple JSX prop spread.
  - Reviewer: confirm the probe covers only out-of-scope legal patterns and does not accidentally contain an in-scope MVP violation.

- [x] **T3.2 Run lint against legal probe**
  - Engineer: run ESLint against the negative probe and capture pass evidence.
  - Reviewer: confirm the D4-MVP gate does not fire. If unrelated lint rules fail, require the Engineer to adjust the probe or document that the D4 selectors did not fire.

- [x] **T3.3 Remove probe**
  - Engineer: delete/revert the temporary negative probe.
  - Reviewer: confirm `git status --short` has no probe file.

**Acceptance criteria**:

- [x] Single ternary passes the D4-MVP gate.
- [x] Expression-bodied `map` passes the D4-MVP gate.
- [x] Prepared props spread passes the D4-MVP gate.
- [x] Simple JSX prop spread passes the D4-MVP gate.
- [x] The temporary negative probe is removed before commit.
- [x] Reviewer PASS records both T2 positive fail evidence and T3 negative pass evidence.

**Verification commands**:

```bash
npx eslint src/path/to/d4-negative-probe.jsx
git status --short
```

**Commit checkpoint**:

No commit for the probe. It must not remain in the final diff.

---

## T4 — Existing Violation Handling

**Engineer**: Baseline Engineer
**Reviewer**: Baseline Reviewer
**Owned files**:

- `eslint.config.mjs`
- optional follow-up note in `specs/035-gap-d4-jsx-logic-gate/tasks.md` only if baseline is needed

**Dependencies**: T1 parse check, T2 positive smoke, and T3 negative smoke complete.

- [x] **T4.1 Run source lint**
  - Engineer: run `npx eslint src --no-error-on-unmatched-pattern`.
  - Reviewer: classify any failures as D4-MVP violations, unrelated existing lint, or selector bug.

- [x] **T4.2 Decide baseline vs cleanup**
  - Engineer: if existing D4-MVP violations exist, propose either an explicit temporary baseline or a separate cleanup slice.
  - Reviewer: reject silent selector weakening. Require an explicit count/path baseline or separate approved cleanup.

**Acceptance criteria**:

- [x] Existing source violations are not hidden by weakening MVP selectors.
- [x] Any baseline has explicit file paths, count, and retirement task.
- [x] No unapproved production refactor is done.

**Baseline evidence**:

- `npx eslint src --no-error-on-unmatched-pattern` exposed 14 existing D4-MVP violations across 10 files.
- This baseline is not full D4 closure. It only lets the D4-MVP gate land without unapproved production cleanup.
- The D4-MVP `ignores` list must not grow. New files with D4-MVP violations should fail lint.
- Follow-up cleanup must remove each file from `eslint.config.mjs` after its JSX logic is moved out of render.

**Baseline files**:

- `src/components/CommentHistoryModal.jsx`
- `src/components/EventRouteEditor.jsx`
- `src/components/Navbar/MobileDrawer.jsx`
- `src/components/Navbar/Navbar.jsx`
- `src/components/PostCard.jsx`
- `src/components/RunCalendarDialog.jsx`
- `src/components/weather/FavoritesBar.jsx`
- `src/ui/events/EventsListSection.jsx`
- `src/ui/events/PaceSelector.jsx`
- `src/ui/events/ParticipantsModal.jsx`

**Retirement checklist**:

- [ ] Clean `src/components/CommentHistoryModal.jsx`, then remove it from the D4-MVP baseline.
- [ ] Clean `src/components/EventRouteEditor.jsx`, then remove it from the D4-MVP baseline.
- [ ] Clean `src/components/Navbar/MobileDrawer.jsx`, then remove it from the D4-MVP baseline.
- [ ] Clean `src/components/Navbar/Navbar.jsx`, then remove it from the D4-MVP baseline.
- [ ] Clean `src/components/PostCard.jsx`, then remove it from the D4-MVP baseline.
- [ ] Clean `src/components/RunCalendarDialog.jsx`, then remove it from the D4-MVP baseline.
- [ ] Clean `src/components/weather/FavoritesBar.jsx`, then remove it from the D4-MVP baseline.
- [ ] Clean `src/ui/events/EventsListSection.jsx`, then remove it from the D4-MVP baseline.
- [ ] Clean `src/ui/events/PaceSelector.jsx`, then remove it from the D4-MVP baseline.
- [ ] Clean `src/ui/events/ParticipantsModal.jsx`, then remove it from the D4-MVP baseline.

**Verification commands**:

```bash
npx eslint src --no-error-on-unmatched-pattern
git diff -- eslint.config.mjs specs/035-gap-d4-jsx-logic-gate/tasks.md
```

**Commit checkpoint**:

If baseline is required:

```bash
git add eslint.config.mjs specs/035-gap-d4-jsx-logic-gate/tasks.md
git commit -m "chore: baseline jsx logic gate"
```

If no baseline is required, no separate commit is needed.

---

## T5 — Final Verification

**Engineer**: Release Engineer
**Reviewer**: Release Reviewer
**Owned files**:

- `eslint.config.mjs`
- `specs/035-gap-d4-jsx-logic-gate/spec.md`
- `specs/035-gap-d4-jsx-logic-gate/plan.md`
- `specs/035-gap-d4-jsx-logic-gate/tasks.md`

**Dependencies**: T1, T2, T3, and T4 complete.

- [x] **T5.1 Run repo lint audit**
  - Engineer: run repo lint audit with `npx eslint src specs`.
  - Reviewer: confirm failures, if any, are understood and not introduced by the D4-MVP gate unexpectedly.

- [x] **T5.2 Check changed files**
  - Engineer: run `git status --short` and inspect final diff.
  - Reviewer: confirm no temporary probe and no out-of-scope files.

- [x] **T5.3 Closeout wording**
  - Engineer: prepare final report that says D4-MVP / partial gate.
  - Reviewer: reject wording that says D4 is fully complete or that leaked-render cleanup was done.

**Acceptance criteria**:

- [x] `npx eslint src specs` evidence is recorded.
- [x] Positive smoke fail evidence and negative smoke pass evidence are both recorded.
- [x] Final diff matches approved scope.
- [x] Closeout lists changed files and key behavior.
- [x] D4 remains described as partially mechanized unless a later separate task closes the rest.

**Execution evidence**:

- `npx eslint src/d4-positive-probe.jsx` failed with D4-MVP `no-restricted-syntax` errors for IIFE, nested ternary, JSX-local collection transform, block-bodied `map`, conditional JSX prop spread, and conditional object spread. The temporary probe was removed.
- `npx eslint src/d4-negative-probe.jsx` exited 0 for single ternary, expression-bodied `map`, prepared props spread, and simple identifier prop spread. The temporary probe was removed.
- `npx eslint src --no-error-on-unmatched-pattern` exited 0 after the explicit 14-violation / 10-file baseline was added.
- `npx eslint 'tests/integration/**/*.test.jsx' --no-error-on-unmatched-pattern` exited 0, preserving existing test-specific gates.
- `npx eslint src specs` exited 0 with only the existing React version warning.
- `git diff --check` exited 0.

**Verification commands**:

```bash
npx eslint src specs
git status --short
git diff --stat
```

**Commit checkpoint**:

```bash
git add eslint.config.mjs specs/035-gap-d4-jsx-logic-gate
git commit -m "chore: add jsx logic lint gate"
```
