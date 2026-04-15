#!/usr/bin/env bash
# Run Playwright E2E tests only for current branch's spec folder
set -euo pipefail

BRANCH=$(git rev-parse --abbrev-ref HEAD)
E2E_DIR="specs/$BRANCH/tests/e2e"

if [ ! -d "$E2E_DIR" ]; then
  echo "No E2E test directory found at $E2E_DIR — skipping."
  exit 0
fi

npx playwright test "$E2E_DIR"
