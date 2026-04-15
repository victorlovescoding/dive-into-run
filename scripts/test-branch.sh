#!/usr/bin/env bash
# Run Vitest (unit + integration) only for current branch's spec folder
set -euo pipefail

BRANCH=$(git rev-parse --abbrev-ref HEAD)
SPEC_DIR="specs/$BRANCH/tests"

if [ ! -d "$SPEC_DIR" ]; then
  echo "No test directory found at $SPEC_DIR — skipping."
  exit 0
fi

# Collect existing unit/integration dirs
DIRS=()
[ -d "$SPEC_DIR/unit" ] && DIRS+=("$SPEC_DIR/unit")
[ -d "$SPEC_DIR/integration" ] && DIRS+=("$SPEC_DIR/integration")

if [ ${#DIRS[@]} -eq 0 ]; then
  echo "No unit or integration test directories in $SPEC_DIR — skipping."
  exit 0
fi

npx vitest run "${DIRS[@]}"
