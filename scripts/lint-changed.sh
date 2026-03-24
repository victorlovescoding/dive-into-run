#!/usr/bin/env bash
# Lint only git changed files (staged + unstaged vs HEAD)
set -euo pipefail

FILES=$(git diff --name-only --diff-filter=ACMR HEAD -- '*.js' '*.jsx' '*.mjs')

if [ -z "$FILES" ]; then
  echo "No changed JS files to lint."
  exit 0
fi

echo "$FILES" | xargs npx eslint
