#!/usr/bin/env bash
# Type-check files changed on current branch vs main (or specified base)
set -euo pipefail

BASE=${1:-main}
FILES=$(git diff --name-only --diff-filter=ACMR "$BASE"...HEAD -- '*.js' '*.jsx' '*.mjs')

if [ -z "$FILES" ]; then
  echo "No JS files changed on this branch."
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
' <(printf '%s\n' "$FILES") <(tsc -p tsconfig.check.json 2>&1) || true)

if [ -z "$ERRORS" ]; then
  echo "✓ No type errors in branch-changed files."
  exit 0
else
  echo "$ERRORS"
  echo ""
  echo "✗ Type errors found in branch-changed files."
  exit 1
fi
