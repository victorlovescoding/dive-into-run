#!/usr/bin/env bash
# Lint files changed on current branch vs main (or specified base)
set -euo pipefail

BASE=${1:-main}
FILES=$(git diff --name-only --diff-filter=ACMR "$BASE"...HEAD -- '*.js' '*.jsx' '*.mjs')

if [ -z "$FILES" ]; then
  echo "No JS files changed on this branch."
  exit 0
fi

echo "$FILES" | xargs npx eslint
