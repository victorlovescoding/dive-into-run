#!/usr/bin/env bash
# Run Playwright E2E for current branch's changed spec files
set -euo pipefail

CHANGED_SPECS=$(git diff --name-only main...HEAD -- 'tests/e2e/**' 2>/dev/null | grep -E '\.spec\.(js|jsx)$' || true)

if [ -z "$CHANGED_SPECS" ]; then
  echo "No changed E2E specs on this branch — skipping."
  exit 0
fi

# E2E_FEATURE 仍可用：若有設，跑 emulator config + 該 feature 的 globalSetup
if [ -n "${E2E_FEATURE:-}" ]; then
  # shellcheck disable=SC2086
  npx playwright test --config playwright.emulator.config.mjs $CHANGED_SPECS
else
  # shellcheck disable=SC2086
  npx playwright test --config playwright.config.mjs $CHANGED_SPECS
fi
