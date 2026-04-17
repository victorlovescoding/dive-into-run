#!/usr/bin/env bash
# Type-check only git changed files (tracked diff vs HEAD + untracked new files).
# NOTE: `git diff HEAD` does NOT include untracked files, so we union it with
# `git ls-files --others --exclude-standard` to cover brand-new files that are
# not yet staged (e.g. new test files created during TDD RED phase).
set -euo pipefail

TRACKED=$(git diff --name-only --diff-filter=ACMR HEAD -- '*.js' '*.jsx' '*.mjs')
UNTRACKED=$(git ls-files --others --exclude-standard -- '*.js' '*.jsx' '*.mjs')
FILES=$(printf '%s\n%s\n' "$TRACKED" "$UNTRACKED" | sort -u | sed '/^$/d')

if [ -z "$FILES" ]; then
  echo "No changed JS files to check."
  exit 0
fi

# Run full tsc, filter output to lines whose path prefix matches a changed file.
# NOTE: Use awk literal-string set lookup (fed via process substitution) instead
# of `grep -E` regex, because Next.js dynamic-route paths like
# `src/app/posts/[id]/*.jsx` contain `[` and `]` which grep ERE treats as a
# character class (matching 'i' or 'd'), silently dropping errors for any
# dynamic-route file. awk `-v` cannot accept multi-line values either, so the
# file list is passed as the first input file.
# tsc pipe output format: `path(line,col): error TS...`, so we strip everything
# from the first `(` or `:` to isolate the path.
ERRORS=$(awk '
  FNR == NR { if ($0 != "") set[$0] = 1; next }
  { path = $0; sub(/[(:].*$/, "", path); if (path in set) print }
' <(printf '%s\n' "$FILES") <(tsc --noEmit 2>&1) || true)

if [ -z "$ERRORS" ]; then
  echo "✓ No type errors in changed files."
  exit 0
else
  echo "$ERRORS"
  echo ""
  echo "✗ Type errors found in changed files."
  exit 1
fi
