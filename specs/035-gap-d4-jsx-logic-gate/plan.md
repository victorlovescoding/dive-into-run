# Implementation Plan: Gap D4 JSX Logic Gate

**Branch**: `035-gap-d4-jsx-logic-gate` | **Date**: 2026-05-10 | **Spec**: [spec.md](./spec.md)
**Input**: Gap D4 option A confirmed as `D4-MVP gate`.

## Summary

Add an ESLint-only D4-MVP gate that mechanically blocks a narrow high-confidence subset of `No logic in JSX`: JSX IIFEs, nested ternaries, JSX-local `filter` / `reduce` / `sort` / `toSorted`, block-bodied `map` callbacks, and conditional object spread. This is a partial gate, not full D4 closure.

## Source Context

- `.codex/rules/coding-rules.md` says `No logic in JSX` is a non-negotiable rule.
- The D4 source is an ignored project-health snapshot from the main checkout: `/Users/chentzuyu/Desktop/dive-into-run/project-health/2026-04-24-openai-harness-gap-analysis.md`.
- `project-health/` is ignored and is not expected to exist in this worktree. Do not copy it into the worktree.
- The only D4 facts this plan depends on are: D4 is still open / unverified; this task builds a selected high-confidence JSX logic mechanical gate; this task does not close complete D4.
- `eslint.config.mjs` already uses `no-restricted-syntax` for mechanical gates, especially test mock/flaky patterns. Those blocks show the current local pattern: targeted file globs, explicit selector objects, and remediation-oriented messages.

## Technical Approach

Implement the MVP as a new `eslint.config.mjs` flat-config block for `src/**/*.{js,jsx}`. Keep it separate from existing test-only `no-restricted-syntax` blocks so flat-config last-write-wins behavior does not erase test selectors.

Recommended placement: after source-wide rule blocks and before test-specific override blocks, or anywhere that applies only to `src/**/*.{js,jsx}` and does not overlap `tests/**`.

Do not change production code unless the new gate exposes existing in-scope violations that must be baseline-drained. If existing violations appear, either:

1. Add a temporary MVP baseline in `ignores` with explicit count and follow-up task, or
2. Refactor only the minimum affected JSX in a separate implementation session after user approval.

For this feature, the preferred first implementation is baseline-free only if `npx eslint src` proves the selectors introduce no existing violations.

## Files

### Create

- `specs/035-gap-d4-jsx-logic-gate/spec.md` — WHAT/WHY, requirements, user scenarios, acceptance criteria.
- `specs/035-gap-d4-jsx-logic-gate/plan.md` — technical approach, selectors, verification, implementation notes.
- `specs/035-gap-d4-jsx-logic-gate/tasks.md` — Engineer + Reviewer task queue.

### Modify During Implementation

- `eslint.config.mjs` — add the D4-MVP `no-restricted-syntax` block.

### Do Not Modify For This Planning Task

- `src/**`
- `tests/**`
- runtime config
- production behavior

## ESLint Selectors

Use one source-only `no-restricted-syntax` array. Messages should be direct remediation guidance for agents.

```js
// D4-MVP: high-confidence No logic in JSX gate.
{
  files: ['src/**/*.{js,jsx}'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "JSXExpressionContainer > CallExpression[callee.type=/^(ArrowFunctionExpression|FunctionExpression)$/]",
        message:
          'No IIFEs inside JSX. Move branching/data preparation above the return, or extract a helper/component before rendering.',
      },
      {
        selector: 'JSXExpressionContainer ConditionalExpression ConditionalExpression',
        message:
          'No nested ternaries inside JSX. Prepare a named render state before JSX or extract the branch into a small component.',
      },
      {
        selector:
          "JSXExpressionContainer CallExpression[callee.property.name=/^(filter|reduce|sort|toSorted)$/]",
        message:
          'No filter/reduce/sort/toSorted inside JSX. Compute the collection before JSX so render markup stays declarative.',
      },
      {
        selector:
          "JSXExpressionContainer CallExpression[callee.property.name='map'] > ArrowFunctionExpression[body.type='BlockStatement']",
        message:
          'No block-bodied map callbacks inside JSX. Extract the callback, precompute rows, or render a child component.',
      },
      {
        selector:
          "JSXExpressionContainer ObjectExpression > SpreadElement[argument.type='ConditionalExpression']",
        message:
          'No conditional object spread inside JSX. Build props/style objects before JSX and pass the prepared value.',
      },
      {
        selector: "JSXSpreadAttribute[argument.type='ConditionalExpression']",
        message:
          'No conditional JSX prop spread. Build the props object before JSX and spread the prepared value.',
      },
      {
        selector:
          "JSXSpreadAttribute ObjectExpression > SpreadElement[argument.type='ConditionalExpression']",
        message:
          'No conditional object spread inside JSX props. Build props/style objects before JSX and pass the prepared value.',
      },
    ],
  },
}
```

### Selector Notes

- IIFE selector targets direct JSX expression containers such as `{(() => value)()}` and `{(function () { return value; })()}`.
- Nested ternary selector intentionally targets nested `ConditionalExpression` under JSX. A single simple ternary is out of this MVP.
- Collection method selector blocks the high-noise render-time transformations named in scope only.
- Block-bodied `map` callback is blocked because it usually hides statement logic in render markup. Expression-bodied `map` remains out of scope for this MVP.
- Conditional spread has separate selectors for object spreads inside JSX expression containers and direct JSX prop spreads.
- If any selector fails to parse under ESLint/esquery, implementation must replace only that selector with a proven equivalent and record the change in the task evidence.

## Verification

Run verification in this order:

1. **Selector parse check**

   ```bash
   npx eslint src --no-error-on-unmatched-pattern
   ```

   Expected: ESLint config loads. Any failures are either real existing violations or selector syntax issues.

2. **Positive smoke probe**

   Temporarily add one local probe file under a throwaway path that matches `src/**/*.{js,jsx}` and contains each blocked pattern:

   - IIFE inside JSX
   - nested ternary inside JSX
   - JSX-local `filter`, `reduce`, `sort`, or `toSorted`
   - block-bodied `map` callback inside JSX
   - conditional object spread inside JSX

   ```bash
   npx eslint src/path/to/d4-positive-probe.jsx
   ```

   Expected: FAIL with D4-MVP lint errors and remediation messages.

   Revert/delete the probe before commit.

3. **Negative smoke probe**

   Temporarily add one local probe file under a throwaway path that matches `src/**/*.{js,jsx}` and contains legal out-of-scope JSX patterns:

   - single ternary expression
   - expression-bodied `map` callback
   - prepared props spread, such as `<Panel {...preparedProps} />`
   - simple JSX prop spread from a local object identifier

   ```bash
   npx eslint src/path/to/d4-negative-probe.jsx
   ```

   Expected: PASS for the D4-MVP gate. If unrelated lint rules fail, either adjust the probe to satisfy existing style rules or document that the D4-MVP selectors did not fire.

   Revert/delete the probe before commit.

4. **Existing gate preservation**

   ```bash
   npx eslint tests/integration/**/*.test.jsx --no-error-on-unmatched-pattern
   ```

   Expected: existing test-specific `no-restricted-syntax` blocks still parse and behave. If existing test lint errors appear, confirm they are unrelated to the new source-only D4 block.

5. **Repo lint audit**

   ```bash
   npx eslint src specs
   ```

   Expected: no unexpected errors from the new gate after any approved baseline handling.

6. **Changed-files check**

   ```bash
   git status --short
   git diff -- specs/035-gap-d4-jsx-logic-gate/spec.md specs/035-gap-d4-jsx-logic-gate/plan.md specs/035-gap-d4-jsx-logic-gate/tasks.md
   ```

   Expected during this planning task: only the three planning docs changed.

## Risk Management

- **False positives**: Keep the MVP narrow. Do not add broad `CallExpression` or arbitrary `LogicalExpression` bans.
- **Negative smoke required**: Reviewer PASS requires both positive smoke fail evidence and negative smoke pass evidence.
- **False completion claim**: Every closeout must say D4-MVP / partial gate.
- **Ignored source note**: Do not require or copy `project-health/`; this plan is the self-contained tracked handoff.
- **Flat-config overwrite**: Do not merge this selector array into test override blocks unless the block owns the same file glob.
- **Existing violations**: If `src/**` already contains MVP violations, do not silently weaken selectors. Either baseline explicitly or schedule a follow-up cleanup.
- **Leaked render backlog**: Do not use this task to clear existing `react/jsx-no-leaked-render` findings.

## Commit Checkpoint

Recommended commit after implementation:

```bash
git add eslint.config.mjs specs/035-gap-d4-jsx-logic-gate
git commit -m "chore: add jsx logic lint gate"
```

Before committing, confirm no temporary probe files remain.
