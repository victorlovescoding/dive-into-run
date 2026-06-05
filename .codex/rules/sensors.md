# Sensors

## Active Sensors

- `npm run type-check:changed` / `type-check:branch`
- `npm run lint:changed` / `lint:branch`
- `npm run audit:use-effect-data-fetching`
- `npm run workflow:links`
- `git diff --check`

## Changed Surface Verification

| Changed surface | Required local verification |
| --------------- | --------------------------- |
| Workflow docs: `AGENTS.md`, `.codex/rules/**`, `.codex/references/**`, `.agents/skills/**` | `npm run workflow:links`, `git diff --check` |
| Workflow scripts: `scripts/check-*.js`, workflow npm scripts | The changed script command, `npm run lint:changed`, `npm run type-check:changed`, `git diff --check` |
| General scripts: `scripts/**` | The changed script command or focused script check, `npm run lint:changed`, `npm run type-check:changed`, `git diff --check` |
| `src/service/**`, `src/runtime/**`, `src/ui/**`, `src/components/**`, `src/app/**` | `npm run lint:changed`, `npm run type-check:changed`; browser evidence remains required for meaningful UI changes |
| `package.json` scripts or dependency metadata | Run the changed npm script, `npm run lint:changed`, `npm run type-check:changed`; stop and report if `package-lock.json` changes unexpectedly |
| Config affecting build/lint/type/dependency graph | Run the affected config command plus `npm run lint:changed` and `npm run type-check:changed`; use full applicable gates when scope is shared or uncertain |

## Pre-commit Gate

Husky pre-commit currently runs:

1. `npm run lint -- --max-warnings 0`
2. `npm run type-check`
3. `npm run depcruise`
4. `npm run spellcheck`
5. `npm run workflow:links`
6. `npm run audit:use-effect-data-fetching`

## Browser Evidence Sensor

UI task slices still require browser evidence when the change affects visible
behavior. Browser evidence does not replace lint, type-check, build, workflow,
or Reviewer checks.
