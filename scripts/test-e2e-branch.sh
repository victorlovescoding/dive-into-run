#!/usr/bin/env bash
# Run Playwright E2E tests only for current branch's spec folder
set -euo pipefail

# E2E_FEATURE env var takes priority; fall back to git branch name (handles CI detached HEAD)
BRANCH=${E2E_FEATURE:-$(git rev-parse --abbrev-ref HEAD)}
E2E_DIR="specs/$BRANCH/tests/e2e"

if [ ! -d "$E2E_DIR" ]; then
  echo "No E2E test directory found at $E2E_DIR — skipping."
  exit 0
fi

# global-setup.js present → needs emulator config (webServer emulator env vars + globalSetup)
if [ -f "$E2E_DIR/global-setup.js" ]; then
  E2E_FEATURE="$BRANCH" npx playwright test --config playwright.emulator.config.mjs
else
  npx playwright test --config playwright.config.mjs "$E2E_DIR"
fi
