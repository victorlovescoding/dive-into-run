#!/usr/bin/env bash
# Type-check files changed on current branch vs main (or specified base)
set -euo pipefail

BASE=${1:-main}
FILES=$(git diff --name-only --diff-filter=ACMR "$BASE"...HEAD -- '*.js' '*.jsx' '*.mjs')

if [ -z "$FILES" ]; then
  echo "No JS files changed on this branch."
  exit 0
fi

PATTERN=$(echo "$FILES" | paste -sd '|' -)
ERRORS=$(tsc -p tsconfig.check.json 2>&1 | grep -E "^($PATTERN)" || true)

if [ -z "$ERRORS" ]; then
  echo "✓ No type errors in branch-changed files."
  exit 0
else
  echo "$ERRORS"
  echo ""
  echo "✗ Type errors found in branch-changed files."
  exit 1
fi
