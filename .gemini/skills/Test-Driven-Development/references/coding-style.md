# Project Coding Standards & Style Guide (Non-Negotiable)

This document defines the **absolute laws** for coding in this project. All AI agents and developers must strictly adhere to these rules. Failure to comply will result in rejected code and failed tasks.

## 1. Core Standards

- **Base Style**: **Airbnb Base + React Hooks**.
- **Frameworks**: Next.js 15 (App Router), React 19.
- **Language**: JavaScript (ES6+) with **JSDoc** for static type checking.
- **Linter**: ESLint 9 (configured in `eslint.config.mjs`).

## 2. JavaScript & JSDoc (The "Type System")

- **Scope**: Applies to **ALL files** (`src/**/*.js`, `src/**/*.jsx`, `tests/**/*.js`, `tests/**/*.jsx`).
- **Strict JSDoc**:
  - **MANDATORY**: All exported functions, components, and constants MUST have JSDoc.
  - **Required Tags**: `@param`, `@returns`, `@description`.
  - **No `any`**: Do not use `{*}` or `any`. Define specific object structures (e.g., `{{ id: string, name: string }}`).
- **Forbidden**:
  - **`@ts-ignore`**: Strictly prohibited unless absolutely necessary for external library issues. Must use `@ts-expect-error` with a comment explaining why.
  - **`var`**: Use `const` by default, `let` only when reassignment is needed.
- **Formatting**:
  - **Semicolons**: **ALWAYS**.
  - **Quotes**: Single quotes `'string'` for JS, Double quotes `"value"` for JSX attributes.
  - **Indentation**: 2 Spaces.
  - **Trailing Commas**: ES5 (objects/arrays).

## 3. React & JSX Rules

- **Components**: Use `function ComponentName() {}` or `const ComponentName = () => {}`.
- **No Logic in JSX**:
  - **FORBIDDEN**: IIFE inside JSX (e.g., `{(() => { ... })()}`).
  - **FORBIDDEN**: Complex ternaries (nested).
  - **SOLUTION**: Extract logic to variables or helper functions _before_ the return statement.
- **Props**:
  - Do NOT use `prop-types`. Use JSDoc `@param {Object} props` to define prop types.
- **ESLint Abuse**:
  - **FORBIDDEN**: `eslint-disable` for A11y rules (e.g., `click-events-have-key-events`). Fix the HTML semantics instead.

## 4. Testing Standards (The Iron Law)

- **Runner**: **Vitest**.
- **Location**:
  - **Standard (Feature)**: `tests/<feature>/[unit|integration|e2e]/...`
  - **Refactoring (Task-Based)**: `tests/<branch>/<task-name>/[unit|integration|e2e]/...`
- **Libraries**:
  - **Integration**: `@testing-library/react` + `@testing-library/user-event`.
  - **Assertions**: `@testing-library/jest-dom` matchers (e.g., `toBeInTheDocument`).
- **Forbidden Patterns**:
  - **`fireEvent`**: **STRICTLY PROHIBITED**. Use `userEvent` (e.g., `await user.click(...)`).
  - **`waitForTimeout`**: **STRICTLY PROHIBITED** in E2E. Use web-first assertions.
  - **`console.log`**: **STRICTLY PROHIBITED** in tests.
- **Mocking**:
  - Global mocks (Leaflet, ResizeObserver) are in `vitest.setup.jsx`. Do not re-mock them.
  - Always clear mocks if manual mocking is used.

## 5. Development Workflow

- **Pre-Commit Checks**:
  1.  `npm run type-check` (Must be 0 errors).
  2.  `npm run lint` (Must be 0 problems).
  3.  `grep -r "@ts-ignore" src tests` (Must be empty).
- **Atomic Commits**: One task, one commit.
