#!/usr/bin/env bash
# Lint only git changed files (tracked diff vs HEAD + untracked new files).
# NOTE: `git diff HEAD` does NOT include untracked files, so we union it with
# `git ls-files --others --exclude-standard` to cover brand-new files that are
# not yet staged (e.g. new test files created during TDD RED phase).
set -euo pipefail

TRACKED=$(git diff --name-only --diff-filter=ACMR HEAD -- '*.js' '*.jsx' '*.mjs')
UNTRACKED=$(git ls-files --others --exclude-standard -- '*.js' '*.jsx' '*.mjs')
FILES=$(printf '%s\n%s\n' "$TRACKED" "$UNTRACKED" | sort -u | sed '/^$/d')

if [ -z "$FILES" ]; then
  echo "No changed JS files to lint."
  exit 0
fi

echo "$FILES" | xargs npx eslint
