# Troubleshooting Reference

> Last-Verified: 2026-05-11
> Agent-only. Current workflow pitfalls that can produce false confidence or stale edits.

---

## 1. Pipeline Exit Code

Bare pipelines can hide the command that actually failed:

```bash
npm run build | tail -20
echo "$?"
```

`$?` reports the final command in the pipeline (`tail`), not necessarily the
build command.

Use one of these instead when the exit code matters:

```bash
npm run build > /tmp/out.txt 2>&1
exit_code=$?
tail -20 /tmp/out.txt
echo "exit: $exit_code"

npm run build | tail -20
echo "exit: ${PIPESTATUS[0]}"

set -o pipefail
npm run build | tail -20
```

## 2. Re-read After External File Changes

Any external tool that can rewrite files invalidates previously read content.
Re-read the target file before applying an edit.

Common triggers:

- `npm install` / `npm uninstall` changing `package.json` or lockfiles
- formatters or linters with `--write` / `--fix`
- Git operations such as pull, checkout, stash pop, or rebase
- codegen and migration scripts

## 3. Pre-commit Fail Then Edit

`git commit` records the staged index, not the working tree. If pre-commit
fails, then you edit files and retry without staging, the commit can still
contain the old staged content.

Required retry flow:

```bash
git add <file>
git diff --cached
git status
git commit -m "..."
```

Do not treat a later hook pass as proof that the staged content is current.

## 4. Stash Diagnostics

When using stash to isolate whether a failure is pre-existing, check stash
state before and after the diagnostic.

```bash
git stash list
git stash push -u -m "debug-<reason>"
npm run build
git stash list
git stash pop
git stash list
```

If the diagnostic command is interrupted, the second `git stash list` prevents an
unnoticed orphan stash.

## 5. Phantom TS2307 From Direct tsc

Avoid direct file-mode TypeScript checks like:

```bash
npx tsc --noEmit --allowJs --checkJs src/foo.js
```

`tsc <files>` can bypass `tsconfig.json` path mapping, so `@/...` imports may
fail with phantom `TS2307 Cannot find module` errors even when repo type-check
is clean.

Use the repo scripts or explicitly load the project:

```bash
npm run type-check
npm run type-check:changed
npx tsc --noEmit --project tsconfig.json
```

If many `@/...` imports fail at once, first verify with `npm run type-check`
before changing imports.
