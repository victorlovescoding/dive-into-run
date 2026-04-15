#!/usr/bin/env bash
# Type-check only git changed files (staged + unstaged vs HEAD)
set -euo pipefail

FILES=$(git diff --name-only --diff-filter=ACMR HEAD -- '*.js' '*.jsx' '*.mjs')

if [ -z "$FILES" ]; then
  echo "No changed JS files to check."
  exit 0
fi

# Run full tsc, filter output to only show errors from changed files
PATTERN=$(echo "$FILES" | paste -sd '|' -)
ERRORS=$(tsc -p tsconfig.check.json 2>&1 | grep -E "^($PATTERN)" || true)

if [ -z "$ERRORS" ]; then
  echo "✓ No type errors in changed files."
  exit 0
else
  echo "$ERRORS"
  echo ""
  echo "✗ Type errors found in changed files."
  exit 1
fi
