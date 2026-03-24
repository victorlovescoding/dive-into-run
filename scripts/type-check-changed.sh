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
tsc -p tsconfig.check.json 2>&1 | grep -E "^($PATTERN)" || echo "No type errors in changed files."
