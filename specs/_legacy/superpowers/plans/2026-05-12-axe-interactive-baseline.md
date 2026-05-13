# Axe Interactive Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make emulator-backed interactive axe scans fail only on newly observed normalized accessibility violation signatures while preserving report-only artifacts for known event-comment findings.

**Architecture:** Keep production code untouched and implement the gate entirely inside Playwright quality-gate test code. Add a committed JSON baseline keyed by `route + state + signature`, compare current axe findings against that scoped baseline, attach raw and summary artifacts on every run, and fail only when the current scan contains signatures not already reviewed in the baseline. The empty baseline is created before any interactive scan calls the compare helper; the first targeted run is expected to fail only to expose concrete signatures for review.

**Tech Stack:** Next.js 15 / React 19 app under test, Playwright Chromium E2E, Firebase Auth/Firestore/Storage emulators, `@axe-core/playwright`, JavaScript with JSDoc `checkJs`.

---

## Scope And Constraints

Profile: P3, because this is shared E2E quality-gate infrastructure with emulator-backed coverage and a committed baseline contract.

Authorization boundary for implementation: edit only. Commit, push, PR creation, merge, and local `main` sync require explicit authorization after Engineer and Reviewer pass.

Non-scope:

- Do not change production code under `src/**`.
- Do not change package dependencies, package scripts, GitHub workflows, AGENTS, project-health, Firebase schema, Firebase rules, or emulator setup unless a task below says to stop and ask.
- Do not commit raw axe JSON, Playwright reports, videos, screenshots, or generated `reports/**` output.
- Do not convert existing route smoke axe scans to hard gates.

Stop conditions:

- Required event-comment state cannot be reached with the existing `046-quality-gates` seeded emulator data and current UI selectors.
- Baseline comparison needs a package, workflow, Firebase setup, production code, schema, or rules change.
- Normalized signatures differ across two consecutive targeted emulator runs without a code or baseline change.
- A baseline entry lacks `route`, `state`, `ruleId`, `impact`, `target`, `signature`, `reason`, `owner`, or `expiry`.

## File Structure Map

Future implementation may touch only these files:

- Modify: `tests/e2e/quality-gates/quality-gate-helpers.js`
  - Responsibility: normalize axe violations into stable entry objects, load and validate the committed interactive baseline, compare current entries to scoped baseline entries, attach raw and summary artifacts, and throw a useful error for new signatures.
- Modify: `tests/e2e/quality-gates/axe-smoke.spec.js`
  - Responsibility: existing helper-level Playwright assertions. Extend the current pure assertion test to cover normalization object shape, scoped baseline comparison, known/missing/new classification, and validation failures without browser navigation.
- Modify: `tests/e2e/quality-gates/axe-interactive-emulator.spec.js`
  - Responsibility: emulator-backed event comment interactive states. Drive stable UI flows and call the baseline compare helper for each covered state.
- Create/Modify: `tests/e2e/quality-gates/axe-interactive-baseline.json`
  - Responsibility: reviewed normalized signatures for the `axe-interactive-emulator` gate, with metadata and one entry per allowed `route + state + signature`. Task 2 creates the valid empty file; Task 4 replaces `entries` with values copied from actual summary artifacts.

Read-only context for all tasks:

- `specs/_legacy/superpowers/designs/2026-05-12-axe-interactive-baseline-design.md`
- `AGENTS.md`
- `docs/superpowers/workflow.md`
- `docs/superpowers/task-profiles.md`
- `.codex/rules/testing-standards.md`
- `.codex/rules/e2e-commands.md`
- `tests/e2e/_setup/046-quality-gates-global-setup.js`
- `tests/e2e/event-comments.spec.js`
- `playwright.emulator.config.mjs`
- `package.json`

Dependency graph:

- Task 1 blocks Task 2 because tests define the helper contract.
- Task 2 blocks Task 3 because interactive scans need both the compare helper and an existing valid empty baseline file.
- Task 3 blocks Task 4 because baseline values must come from the implemented interactive state summary artifacts.
- Task 4 blocks Task 5 because final verification needs the committed baseline.

Parallel waves:

- Wave 1: Task 1.
- Wave 2: Task 2.
- Wave 3: Task 3.
- Wave 4: Task 4.
- Wave 5: Task 5.

## Baseline Contract

Committed baseline file path:

```text
tests/e2e/quality-gates/axe-interactive-baseline.json
```

Top-level JSON shape:

```json
{
  "version": 1,
  "generatedFor": "axe-interactive-emulator",
  "metadata": {
    "createdOn": "2026-05-12",
    "sourceFeature": "046-quality-gates",
    "sourceSpec": "tests/e2e/quality-gates/axe-interactive-emulator.spec.js",
    "reviewedScope": "event comment interactive states only"
  },
  "entries": []
}
```

Task 2 commits this empty `entries` array so the loader never depends on a missing file. Task 4 is the only task that populates `entries`, and it must copy concrete `state`, `ruleId`, `impact`, `target`, and `signature` values from the generated `axe-<state>-summary.json` artifacts.

Helper entry shape:

```js
/**
 * @typedef {object} AxeViolationEntry
 * @property {string} ruleId
 * @property {string} impact
 * @property {string} target
 * @property {string} signature
 */

/**
 * @typedef {AxeViolationEntry & {
 *   route: string,
 *   state: string,
 *   reason: string,
 *   owner: string,
 *   expiry: string,
 * }} AxeInteractiveBaselineEntry
 */
```

Summary artifact shape:

```json
{
  "url": "http://localhost:3000/events/test-event-comments",
  "route": "/events/test-event-comments",
  "state": "event-comment-edit-dialog",
  "violationCount": 1,
  "current": [
    {
      "ruleId": "aria-required-children",
      "impact": "critical",
      "target": "div[role=\"menu\"]",
      "signature": "aria-required-children|critical|div[role=\"menu\"]"
    }
  ],
  "baselineKnown": [],
  "newSignatures": [],
  "noLongerObserved": []
}
```

## Task 1: Helper Contract Assertions

**Owned files:**

- Modify: `tests/e2e/quality-gates/axe-smoke.spec.js`
- Read-only context: `tests/e2e/quality-gates/quality-gate-helpers.js`

**Acceptance Criteria:**

- `axe-smoke.spec.js` still keeps route smoke scans report-only.
- The pure helper assertion covers sorted `AxeViolationEntry` objects.
- The pure helper assertion proves scoped compare behavior: known signatures pass, new signatures are returned, missing baseline signatures are reported as `noLongerObserved`, and same signature in a different state does not pass.
- Validation assertion proves malformed baseline entries throw before comparison.

**Verification:**

- `npx playwright test --config playwright.config.mjs tests/e2e/quality-gates/axe-smoke.spec.js`
  - Expected: before Task 2 implementation, helper contract imports or assertions fail.
  - Expected after Task 2: all tests in `axe-smoke.spec.js` pass.

- [ ] **Step 1: Extend helper imports**

Change the import in `tests/e2e/quality-gates/axe-smoke.spec.js` to this shape:

```js
import {
  attachAxeReportOnly,
  compareAxeViolationsToBaseline,
  normalizeAxeViolationEntries,
  normalizeAxeViolationSignatures,
  validateAxeInteractiveBaseline,
} from './quality-gate-helpers.js';
```

- [ ] **Step 2: Add entry-shape normalization assertion**

Place this test next to the existing `normalizes axe violation signatures in stable sorted order` test:

```js
  test('normalizes axe violation entries in stable sorted order', () => {
    const entries = normalizeAxeViolationEntries([
      {
        id: 'color-contrast',
        impact: 'serious',
        nodes: [{ target: ['.secondary'] }, { target: ['.primary'] }],
      },
      {
        id: 'aria-dialog-name',
        impact: 'critical',
        nodes: [{ target: ['#dialog'] }],
      },
    ]);

    expect(entries).toEqual([
      {
        ruleId: 'aria-dialog-name',
        impact: 'critical',
        target: '#dialog',
        signature: 'aria-dialog-name|critical|#dialog',
      },
      {
        ruleId: 'color-contrast',
        impact: 'serious',
        target: '.primary',
        signature: 'color-contrast|serious|.primary',
      },
      {
        ruleId: 'color-contrast',
        impact: 'serious',
        target: '.secondary',
        signature: 'color-contrast|serious|.secondary',
      },
    ]);
  });
```

- [ ] **Step 3: Add scoped baseline comparison assertion**

Add this pure assertion in the same `test.describe('axe smoke report-only', ...)` block:

```js
  test('compares axe entries against scoped interactive baseline', () => {
    const comparison = compareAxeViolationsToBaseline({
      route: '/events/test-event-comments',
      state: 'event-comment-edit-dialog',
      current: [
        {
          ruleId: 'aria-required-children',
          impact: 'critical',
          target: 'div[role="menu"]',
          signature: 'aria-required-children|critical|div[role="menu"]',
        },
        {
          ruleId: 'aria-dialog-name',
          impact: 'serious',
          target: '#edit-dialog',
          signature: 'aria-dialog-name|serious|#edit-dialog',
        },
      ],
      baseline: {
        version: 1,
        generatedFor: 'axe-interactive-emulator',
        metadata: {
          createdOn: '2026-05-12',
          sourceFeature: '046-quality-gates',
          sourceSpec: 'tests/e2e/quality-gates/axe-interactive-emulator.spec.js',
          reviewedScope: 'event comment interactive states only',
        },
        entries: [
          {
            route: '/events/test-event-comments',
            state: 'event-comment-edit-dialog',
            ruleId: 'aria-required-children',
            impact: 'critical',
            target: 'div[role="menu"]',
            signature: 'aria-required-children|critical|div[role="menu"]',
            reason: 'Known existing finding reviewed before PR C hard-gate rollout.',
            owner: 'quality-gates',
            expiry: '2026-08-12',
          },
          {
            route: '/events/test-event-comments',
            state: 'event-comment-edit-dialog',
            ruleId: 'color-contrast',
            impact: 'serious',
            target: '.old-node',
            signature: 'color-contrast|serious|.old-node',
            reason: 'Known existing finding reviewed before PR C hard-gate rollout.',
            owner: 'quality-gates',
            expiry: '2026-08-12',
          },
          {
            route: '/events/test-event-comments',
            state: 'event-comment-delete-confirm-dialog',
            ruleId: 'aria-dialog-name',
            impact: 'serious',
            target: '#edit-dialog',
            signature: 'aria-dialog-name|serious|#edit-dialog',
            reason: 'Known finding in a different state must not allow edit dialog.',
            owner: 'quality-gates',
            expiry: '2026-08-12',
          },
        ],
      },
    });

    expect(comparison.baselineKnown.map((entry) => entry.signature)).toEqual([
      'aria-required-children|critical|div[role="menu"]',
    ]);
    expect(comparison.newSignatures.map((entry) => entry.signature)).toEqual([
      'aria-dialog-name|serious|#edit-dialog',
    ]);
    expect(comparison.noLongerObserved.map((entry) => entry.signature)).toEqual([
      'color-contrast|serious|.old-node',
    ]);
  });
```

- [ ] **Step 4: Add validation failure assertion**

Add this assertion:

```js
  test('rejects malformed interactive axe baseline entries', () => {
    expect(() =>
      validateAxeInteractiveBaseline({
        version: 1,
        generatedFor: 'axe-interactive-emulator',
        metadata: {
          createdOn: '2026-05-12',
          sourceFeature: '046-quality-gates',
          sourceSpec: 'tests/e2e/quality-gates/axe-interactive-emulator.spec.js',
          reviewedScope: 'event comment interactive states only',
        },
        entries: [
          {
            route: '/events/test-event-comments',
            state: 'event-comment-edit-dialog',
            ruleId: 'aria-required-children',
            impact: 'critical',
            target: 'div[role="menu"]',
            signature: 'aria-required-children|critical|div[role="menu"]',
            reason: '',
            owner: 'quality-gates',
            expiry: '2026-08-12',
          },
        ],
      }),
    ).toThrow(/entries\[0\]\.reason/);
  });
```

- [ ] **Step 5: Run the failing helper contract test**

Run:

```bash
npx playwright test --config playwright.config.mjs tests/e2e/quality-gates/axe-smoke.spec.js
```

Expected before Task 2: exits non-zero because the imported helper functions do not exist.

## Task 2: Baseline File And Compare Helpers

**Owned files:**

- Modify: `tests/e2e/quality-gates/quality-gate-helpers.js`
- Create: `tests/e2e/quality-gates/axe-interactive-baseline.json`
- Read-only context: `tests/e2e/quality-gates/axe-smoke.spec.js`

**Acceptance Criteria:**

- `axe-interactive-baseline.json` exists before any interactive spec calls the loader.
- The initial baseline has valid metadata and `entries: []`; it intentionally allows Task 3 to fail only on newly observed signatures while still attaching summary artifacts.
- Existing `attachAxeReportOnly()` behavior and attachment names remain compatible with `axe-smoke.spec.js`.
- New helper exports are `normalizeAxeViolationEntries`, `validateAxeInteractiveBaseline`, `loadAxeInteractiveBaseline`, `compareAxeViolationsToBaseline`, and `attachAxeInteractiveBaselineReport`.
- Baseline validation rejects missing top-level metadata, wrong version, wrong `generatedFor`, non-array `entries`, missing entry fields, empty string fields, and `signature` values that do not match `ruleId|impact|target`.
- Comparison is scoped by exact `route` and `state`.
- `attachAxeInteractiveBaselineReport()` always attaches raw and summary JSON before throwing on new signatures.

**Verification:**

- `npx playwright test --config playwright.config.mjs tests/e2e/quality-gates/axe-smoke.spec.js`
  - Expected: exits 0 after helper implementation.

- [ ] **Step 1: Create the empty baseline file**

Create `tests/e2e/quality-gates/axe-interactive-baseline.json` with exactly:

```json
{
  "version": 1,
  "generatedFor": "axe-interactive-emulator",
  "metadata": {
    "createdOn": "2026-05-12",
    "sourceFeature": "046-quality-gates",
    "sourceSpec": "tests/e2e/quality-gates/axe-interactive-emulator.spec.js",
    "reviewedScope": "event comment interactive states only"
  },
  "entries": []
}
```

- [ ] **Step 2: Add Node imports and constants**

At the top of `quality-gate-helpers.js`, add:

```js
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
```

Then add these constants below `HYDRATION_MESSAGE_PATTERNS`:

```js
const AXE_INTERACTIVE_BASELINE_FILE = 'axe-interactive-baseline.json';
const AXE_INTERACTIVE_BASELINE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  AXE_INTERACTIVE_BASELINE_FILE,
);
const AXE_INTERACTIVE_BASELINE_VERSION = 1;
const AXE_INTERACTIVE_BASELINE_NAME = 'axe-interactive-emulator';
```

- [ ] **Step 3: Add entry normalization**

Replace the current signature implementation with entry normalization while preserving the existing signature export:

```js
/**
 * Builds stable sorted axe violation entries.
 * @param {{ id?: string, impact?: string | null, nodes?: { target?: unknown }[] }[]} violations
 * @returns {AxeViolationEntry[]}
 */
export function normalizeAxeViolationEntries(violations) {
  return violations
    .flatMap((violation) => {
      const ruleId = violation.id ?? '';
      const impact = violation.impact ?? '';
      return (violation.nodes ?? []).map((node) => {
        const target = normalizeAxeTarget(node.target);
        return {
          ruleId,
          impact,
          target,
          signature: `${ruleId}|${impact}|${target}`,
        };
      });
    })
    .sort((left, right) => left.signature.localeCompare(right.signature));
}

/**
 * Builds stable sorted axe violation signatures as ruleId|impact|target.
 * @param {{ id?: string, impact?: string | null, nodes?: { target?: unknown }[] }[]} violations
 * @returns {string[]} Stable sorted violation signatures.
 */
export function normalizeAxeViolationSignatures(violations) {
  return normalizeAxeViolationEntries(violations).map((entry) => entry.signature);
}
```

- [ ] **Step 4: Add baseline validation**

Add these helpers below `normalizeAxeViolationSignatures()`:

```js
function assertNonEmptyString(value, pathLabel) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid axe interactive baseline: ${pathLabel} must be a non-empty string`);
  }
}

function assertBaselineEntry(entry, index) {
  const prefix = `entries[${index}]`;
  assertNonEmptyString(entry?.route, `${prefix}.route`);
  assertNonEmptyString(entry?.state, `${prefix}.state`);
  assertNonEmptyString(entry?.ruleId, `${prefix}.ruleId`);
  assertNonEmptyString(entry?.impact, `${prefix}.impact`);
  assertNonEmptyString(entry?.target, `${prefix}.target`);
  assertNonEmptyString(entry?.signature, `${prefix}.signature`);
  assertNonEmptyString(entry?.reason, `${prefix}.reason`);
  assertNonEmptyString(entry?.owner, `${prefix}.owner`);
  assertNonEmptyString(entry?.expiry, `${prefix}.expiry`);

  const expectedSignature = `${entry.ruleId}|${entry.impact}|${entry.target}`;
  if (entry.signature !== expectedSignature) {
    throw new Error(
      `Invalid axe interactive baseline: ${prefix}.signature must equal ${expectedSignature}`,
    );
  }
}

/**
 * Validates the committed axe interactive baseline contract.
 * @param {unknown} baseline
 * @returns {asserts baseline is {
 *   version: number,
 *   generatedFor: string,
 *   metadata: Record<string, string>,
 *   entries: AxeInteractiveBaselineEntry[],
 * }}
 */
export function validateAxeInteractiveBaseline(baseline) {
  if (!baseline || typeof baseline !== 'object') {
    throw new Error('Invalid axe interactive baseline: root must be an object');
  }

  if (baseline.version !== AXE_INTERACTIVE_BASELINE_VERSION) {
    throw new Error('Invalid axe interactive baseline: version must be 1');
  }

  if (baseline.generatedFor !== AXE_INTERACTIVE_BASELINE_NAME) {
    throw new Error(
      `Invalid axe interactive baseline: generatedFor must be ${AXE_INTERACTIVE_BASELINE_NAME}`,
    );
  }

  assertNonEmptyString(baseline.metadata?.createdOn, 'metadata.createdOn');
  assertNonEmptyString(baseline.metadata?.sourceFeature, 'metadata.sourceFeature');
  assertNonEmptyString(baseline.metadata?.sourceSpec, 'metadata.sourceSpec');
  assertNonEmptyString(baseline.metadata?.reviewedScope, 'metadata.reviewedScope');

  if (!Array.isArray(baseline.entries)) {
    throw new Error('Invalid axe interactive baseline: entries must be an array');
  }

  baseline.entries.forEach(assertBaselineEntry);
}
```

- [ ] **Step 5: Add loader and compare helper**

Add:

```js
/**
 * Loads the committed interactive axe baseline JSON.
 * @returns {Promise<{
 *   version: number,
 *   generatedFor: string,
 *   metadata: Record<string, string>,
 *   entries: AxeInteractiveBaselineEntry[],
 * }>}
 */
export async function loadAxeInteractiveBaseline() {
  const baseline = JSON.parse(await readFile(AXE_INTERACTIVE_BASELINE_PATH, 'utf8'));
  validateAxeInteractiveBaseline(baseline);
  return baseline;
}

/**
 * Compares current axe entries against the scoped route/state baseline.
 * @param {{
 *   route: string,
 *   state: string,
 *   current: AxeViolationEntry[],
 *   baseline: { entries: AxeInteractiveBaselineEntry[] },
 * }} options
 * @returns {{
 *   baselineKnown: AxeViolationEntry[],
 *   newSignatures: AxeViolationEntry[],
 *   noLongerObserved: AxeInteractiveBaselineEntry[],
 * }}
 */
export function compareAxeViolationsToBaseline({ route, state, current, baseline }) {
  const scopedBaseline = baseline.entries
    .filter((entry) => entry.route === route && entry.state === state)
    .sort((left, right) => left.signature.localeCompare(right.signature));
  const baselineSignatures = new Set(scopedBaseline.map((entry) => entry.signature));
  const currentSignatures = new Set(current.map((entry) => entry.signature));

  return {
    baselineKnown: current.filter((entry) => baselineSignatures.has(entry.signature)),
    newSignatures: current.filter((entry) => !baselineSignatures.has(entry.signature)),
    noLongerObserved: scopedBaseline.filter((entry) => !currentSignatures.has(entry.signature)),
  };
}
```

- [ ] **Step 6: Add interactive attach helper**

Add this helper without changing `attachAxeReportOnly()`:

```js
/**
 * Runs axe, attaches raw and baseline summary artifacts, and fails only on new signatures.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {{ route: string, state: string }} scope
 * @returns {Promise<void>}
 */
export async function attachAxeInteractiveBaselineReport(page, testInfo, { route, state }) {
  const baseline = await loadAxeInteractiveBaseline();
  const results = await new AxeBuilder({ page }).analyze();
  const current = normalizeAxeViolationEntries(results.violations);
  const comparison = compareAxeViolationsToBaseline({ route, state, current, baseline });
  const summary = {
    url: page.url(),
    route,
    state,
    violationCount: results.violations.length,
    current,
    baselineKnown: comparison.baselineKnown,
    newSignatures: comparison.newSignatures,
    noLongerObserved: comparison.noLongerObserved,
  };

  await testInfo.attach(`axe-${state}-summary.json`, {
    body: JSON.stringify(summary, null, 2),
    contentType: 'application/json',
  });

  await testInfo.attach(`axe-${state}-raw.json`, {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });

  if (comparison.baselineKnown.length > 0 || comparison.noLongerObserved.length > 0) {
    testInfo.annotations.push({
      type: 'axe-baseline-known',
      description: `${state}: ${comparison.baselineKnown.length} known, ${comparison.noLongerObserved.length} no longer observed`,
    });
  }

  if (comparison.newSignatures.length === 0) {
    return;
  }

  const details = comparison.newSignatures
    .map(
      (entry) =>
        `state=${state} ruleId=${entry.ruleId} impact=${entry.impact} target=${entry.target} signature=${entry.signature}`,
    )
    .join('\n');
  throw new Error(`New axe violation signature(s) detected:\n${details}`);
}
```

- [ ] **Step 7: Run helper contract verification**

Run:

```bash
npx playwright test --config playwright.config.mjs tests/e2e/quality-gates/axe-smoke.spec.js
```

Expected: exits 0 and route smoke attachments remain report-only.

## Task 3: Event Comment Interactive States

**Owned files:**

- Modify: `tests/e2e/quality-gates/axe-interactive-emulator.spec.js`
- Read-only context: `tests/e2e/event-comments.spec.js`, `tests/e2e/_setup/046-quality-gates-global-setup.js`, `playwright.emulator.config.mjs`

**Acceptance Criteria:**

- The spec covers exactly these states: `event-comment-empty-submit-disabled`, `event-comment-create-filled-input`, `event-comment-edit-dialog`, `event-comment-delete-confirm-dialog`.
- Each state reaches `/events/test-event-comments` as `test-commenter@example.com`.
- Selectors are role/text based and use Playwright web-first assertions.
- The create-filled state scans before submitting so it does not mutate Firestore.
- The delete-confirm state may create a throwaway comment, opens the confirmation dialog, and scans before confirming deletion.
- Each state calls `attachAxeInteractiveBaselineReport(page, testInfo, { route: EVENT_URL, state })`.

**Verification:**

- `CI=1 firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=046-quality-gates npm run test:e2e:emulator -- tests/e2e/quality-gates/axe-interactive-emulator.spec.js"`
  - Expected before Task 4 baseline seeding: exits non-zero if current findings are not yet represented in `axe-interactive-baseline.json`; raw and summary artifacts are attached.
  - Expected after Task 4: exits 0 when only reviewed baseline signatures are observed.

- [ ] **Step 1: Update imports and constants**

Change the helper import:

```js
import { attachAxeInteractiveBaselineReport } from './quality-gate-helpers.js';
```

Use these constants and helpers in the spec:

```js
const EVENT_URL = '/events/test-event-comments';
const COMMENTER_EMAIL = 'test-commenter@example.com';
const COMMENTER_PASSWORD = 'test-password';

async function loginAndOpenEvent(page) {
  await loginAsUser(page, COMMENTER_EMAIL, COMMENTER_PASSWORD, {
    waitForText: /活動列表/i,
  });
  await page.goto(EVENT_URL);
  await expect(page.getByText('留言者的測試留言')).toBeVisible();
}

async function attachInteractiveAxe(page, testInfo, state) {
  await attachAxeInteractiveBaselineReport(page, testInfo, {
    route: EVENT_URL,
    state,
  });
}
```

- [ ] **Step 2: Add empty submit disabled state**

Add this test:

```js
  test('event comment empty submit disabled matches axe baseline', async ({ page }, testInfo) => {
    await loginAndOpenEvent(page);

    const textbox = page.getByRole('textbox');
    await expect(textbox).toBeVisible();
    await expect(textbox).toHaveValue('');
    await expect(page.getByRole('button', { name: /送出/i })).toBeDisabled();

    await attachInteractiveAxe(page, testInfo, 'event-comment-empty-submit-disabled');
  });
```

- [ ] **Step 3: Add create filled input state**

Add this test:

```js
  test('event comment create filled input matches axe baseline', async ({ page }, testInfo) => {
    await loginAndOpenEvent(page);

    const textbox = page.getByRole('textbox');
    await textbox.fill(`axe filled comment ${Date.now()}`);
    await expect(textbox).not.toHaveValue('');
    await expect(page.getByRole('button', { name: /送出/i })).toBeEnabled();

    await attachInteractiveAxe(page, testInfo, 'event-comment-create-filled-input');
  });
```

- [ ] **Step 4: Convert edit dialog state**

Replace the existing report-only edit dialog test with:

```js
  test('event comment edit dialog matches axe baseline', async ({ page }, testInfo) => {
    await loginAndOpenEvent(page);

    await page.getByRole('button', { name: /更多操作/i }).first().click();
    await page.getByRole('menuitem', { name: /編輯留言/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox')).not.toHaveValue('');
    await expect(page.getByRole('button', { name: /完成編輯/i })).toBeDisabled();

    await attachInteractiveAxe(page, testInfo, 'event-comment-edit-dialog');
  });
```

- [ ] **Step 5: Add delete confirm dialog state**

Add this test:

```js
  test('event comment delete confirm dialog matches axe baseline', async ({ page }, testInfo) => {
    await loginAndOpenEvent(page);

    const uniqueText = `axe delete candidate ${Date.now()}`;
    const textbox = page.getByRole('textbox');
    await textbox.fill(uniqueText);
    await page.getByRole('button', { name: /送出/i }).click();
    await expect(page.getByText(uniqueText)).toBeVisible();

    await page.getByRole('button', { name: /更多操作/i }).first().click();
    await page.getByRole('menuitem', { name: /刪除留言/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByText('確定刪除留言？')).toBeVisible();
    await expect(page.getByRole('button', { name: /確定刪除/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /取消刪除/i })).toBeVisible();

    await attachInteractiveAxe(page, testInfo, 'event-comment-delete-confirm-dialog');
  });
```

- [ ] **Step 6: Run targeted interactive verification**

Run:

```bash
CI=1 firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=046-quality-gates npm run test:e2e:emulator -- tests/e2e/quality-gates/axe-interactive-emulator.spec.js"
```

Expected before Task 4: each state reaches its UI assertions. The command may exit non-zero only because `New axe violation signature(s) detected` appears for signatures not yet seeded in the baseline.

## Task 4: Seed Reviewed Interactive Baseline

**Owned files:**

- Modify: `tests/e2e/quality-gates/axe-interactive-baseline.json`
- Read-only context: Playwright output from Task 3 summary attachments, `specs/_legacy/superpowers/designs/2026-05-12-axe-interactive-baseline-design.md`

**Acceptance Criteria:**

- The committed JSON is parseable and follows the baseline contract exactly.
- `entries` contains one object per current reviewed signature emitted by the Task 3 interactive state summaries.
- If a state has zero current signatures, that state contributes no `entries`.
- Every entry uses exact `route`, `state`, `ruleId`, `impact`, `target`, and `signature` values copied from the state summary artifact.
- Every entry has `reason: "Known existing finding reviewed before PR C hard-gate rollout."`, `owner: "quality-gates"`, and `expiry: "2026-08-12"`.
- No raw axe artifact content is committed.

**Verification:**

- `node -e "JSON.parse(require('node:fs').readFileSync('tests/e2e/quality-gates/axe-interactive-baseline.json','utf8')), console.log('json ok')"`
  - Expected: prints `json ok`.
- `CI=1 firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=046-quality-gates npm run test:e2e:emulator -- tests/e2e/quality-gates/axe-interactive-emulator.spec.js"`
  - Expected: exits 0 with raw and summary artifacts attached for all four states.

- [ ] **Step 1: Locate Task 3 summaries**

Use the Playwright HTML report or `test-results` attachments from the Task 3 run. For each of these files, read only the `current` array:

```text
axe-event-comment-empty-submit-disabled-summary.json
axe-event-comment-create-filled-input-summary.json
axe-event-comment-edit-dialog-summary.json
axe-event-comment-delete-confirm-dialog-summary.json
```

If the runner output does not expose the summary files, rerun Task 3 and inspect the Playwright report artifacts before creating the baseline.

- [ ] **Step 2: Replace empty entries with reviewed artifact values**

Keep the Task 2 top-level structure in `tests/e2e/quality-gates/axe-interactive-baseline.json`:

```json
{
  "version": 1,
  "generatedFor": "axe-interactive-emulator",
  "metadata": {
    "createdOn": "2026-05-12",
    "sourceFeature": "046-quality-gates",
    "sourceSpec": "tests/e2e/quality-gates/axe-interactive-emulator.spec.js",
    "reviewedScope": "event comment interactive states only"
  },
  "entries": []
}
```

For every object in each summary `current` array, append one baseline entry with:

- `route`: the summary `route` value, expected `/events/test-event-comments`
- `state`: the summary `state` value
- `ruleId`: the current object `ruleId` value
- `impact`: the current object `impact` value
- `target`: the current object `target` value
- `signature`: the current object `signature` value
- `reason`: `Known existing finding reviewed before PR C hard-gate rollout.`
- `owner`: `quality-gates`
- `expiry`: `2026-08-12`

If all four summary `current` arrays are empty, leave `entries` as `[]` and record in the Reviewer handoff that the empty reviewed baseline passed because no interactive violations were observed.

Sort `entries` by this key so diffs are deterministic:

```text
route + "\u0000" + state + "\u0000" + signature
```

- [ ] **Step 3: Parse-check the baseline**

Run:

```bash
node -e "JSON.parse(require('node:fs').readFileSync('tests/e2e/quality-gates/axe-interactive-baseline.json','utf8')), console.log('json ok')"
```

Expected: prints `json ok`.

- [ ] **Step 4: Prove baseline allows existing signatures**

Run:

```bash
CI=1 firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=046-quality-gates npm run test:e2e:emulator -- tests/e2e/quality-gates/axe-interactive-emulator.spec.js"
```

Expected: exits 0. If it fails with `New axe violation signature(s) detected`, update only `tests/e2e/quality-gates/axe-interactive-baseline.json` from the latest summary artifact and rerun this same command. If it fails for navigation, auth, emulator, selector, production behavior, or package/workflow reasons, stop and report the blocker.

## Task 5: Integration Verification And Reviewer Handoff

**Owned files:**

- Modify: none unless Reviewer requests a Task 1-4 correction.
- Read-only context: local diff and command output from Tasks 1-4.

**Acceptance Criteria:**

- Changed files are limited to:
  - `tests/e2e/quality-gates/quality-gate-helpers.js`
  - `tests/e2e/quality-gates/axe-smoke.spec.js`
  - `tests/e2e/quality-gates/axe-interactive-emulator.spec.js`
  - `tests/e2e/quality-gates/axe-interactive-baseline.json`
- No production, package, workflow, setup, baseline summary, AGENTS, project-health, or raw artifact files changed.
- Reviewer can verify that report-only route smoke remains report-only and interactive event-comment states are baseline-gated.
- PR body includes summary, scope, verification commands with exit codes, and known residual risk that axe is not full WCAG coverage.

**Verification:**

- `git status --short`
  - Expected: only the four allowed implementation files are changed.
- `npm run lint:changed`
  - Expected: exits 0.
- `npm run type-check:changed`
  - Expected: exits 0.
- `npx playwright test --config playwright.config.mjs tests/e2e/quality-gates/axe-smoke.spec.js`
  - Expected: exits 0.
- `CI=1 firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=046-quality-gates npm run test:e2e:emulator -- tests/e2e/quality-gates/axe-interactive-emulator.spec.js"`
  - Expected: exits 0.
- `git diff --check`
  - Expected: exits 0.

- [ ] **Step 1: Verify changed files**

Run:

```bash
git status --short
```

Expected output paths are limited to:

```text
tests/e2e/quality-gates/quality-gate-helpers.js
tests/e2e/quality-gates/axe-smoke.spec.js
tests/e2e/quality-gates/axe-interactive-emulator.spec.js
tests/e2e/quality-gates/axe-interactive-baseline.json
```

- [ ] **Step 2: Run changed-file lint**

Run:

```bash
npm run lint:changed
```

Expected: exits 0.

- [ ] **Step 3: Run changed-file type check**

Run:

```bash
npm run type-check:changed
```

Expected: exits 0.

- [ ] **Step 4: Run helper and route smoke spec**

Run:

```bash
npx playwright test --config playwright.config.mjs tests/e2e/quality-gates/axe-smoke.spec.js
```

Expected: exits 0 and does not fail on route axe violations.

- [ ] **Step 5: Run interactive emulator spec**

Run:

```bash
CI=1 firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=046-quality-gates npm run test:e2e:emulator -- tests/e2e/quality-gates/axe-interactive-emulator.spec.js"
```

Expected: exits 0 and attaches `axe-<state>-raw.json` plus `axe-<state>-summary.json` for all four states.

- [ ] **Step 6: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: exits 0.

- [ ] **Step 7: Request Reviewer**

Reviewer instructions:

```text
Review only the four allowed files for PR C interactive axe baseline.
Confirm helper validation and compare behavior match the design:
- baseline is scoped by route + state + signature
- known signatures pass
- new signatures fail with state/rule/impact/target/signature details
- missing baseline signatures are summary-only
- raw and summary attachments are emitted before failure
- route smoke axe remains report-only
- no production, package, workflow, setup, AGENTS, project-health, or raw artifact files changed
Rerun or validate the verification commands from Task 5.
Return exactly one decision: review_passed, review_rejected, or blocked.
```

## Closeout Checklist

After Reviewer returns `review_passed`, closeout may proceed only within the user's authorization boundary.

Concrete staging command:

```bash
git add tests/e2e/quality-gates/quality-gate-helpers.js tests/e2e/quality-gates/axe-smoke.spec.js tests/e2e/quality-gates/axe-interactive-emulator.spec.js tests/e2e/quality-gates/axe-interactive-baseline.json
```

Commit message:

```bash
git commit -m "test: gate interactive axe against baseline"
```

PR body skeleton:

```markdown
## Summary
- add scoped interactive axe baseline comparison for event comment states
- add reviewed baseline JSON for current normalized signatures
- keep route axe smoke scans report-only

## Verification
- `npm run lint:changed`
- `npm run type-check:changed`
- `npx playwright test --config playwright.config.mjs tests/e2e/quality-gates/axe-smoke.spec.js`
- `CI=1 firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=046-quality-gates npm run test:e2e:emulator -- tests/e2e/quality-gates/axe-interactive-emulator.spec.js"`
- `git diff --check`

## Residual Risk
- Axe baseline gating blocks newly observed normalized signatures only; it does not prove full WCAG conformance or manual screen-reader quality.
```

## Self-Review

- Spec coverage: Task 1 covers helper-level assertions in the existing `axe-smoke.spec.js` pattern. Task 2 covers baseline schema, validation, scoped compare, artifacts, known/new/missing behavior, and failure messaging. Task 3 covers the four required event comment states. Task 4 covers committed metadata-bearing baseline seeding from current run output. Task 5 covers targeted verification and Reviewer handoff.
- Placeholder scan: This plan contains no unresolved placeholder markers, no broad "add tests" instruction without code, and no references to undefined helper names.
- Type consistency: Helper names and shapes are consistent across tasks: `normalizeAxeViolationEntries`, `normalizeAxeViolationSignatures`, `validateAxeInteractiveBaseline`, `loadAxeInteractiveBaseline`, `compareAxeViolationsToBaseline`, and `attachAxeInteractiveBaselineReport`. Baseline field names match the JSON contract and compare summary contract.
