#!/usr/bin/env bash
# Run Vitest (unit + integration) only for current branch's changed test files
set -euo pipefail

# Get changed .test.* files under tests/ between current branch and main
CHANGED_TESTS=$(git diff --name-only main...HEAD -- 'tests/unit/**' 'tests/integration/**' 'tests/_helpers/**' 2>/dev/null | grep -E '\.test\.(js|jsx)$' || true)

if [ -z "$CHANGED_TESTS" ]; then
  echo "No changed unit/integration tests on this branch — skipping."
  exit 0
fi

# Pass changed files to vitest (or fall back to dirs if too many)
echo "Running vitest on:"
echo "$CHANGED_TESTS"
# shellcheck disable=SC2086
npx vitest run --project=browser $CHANGED_TESTS
