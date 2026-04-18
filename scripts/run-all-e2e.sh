#!/usr/bin/env bash
# Run ALL E2E tests across the entire repo (CI-only script).
# Starts Firebase Emulator + dev server once, then loops every feature.
set -euo pipefail

# ---------------------------------------------------------------------------
# 1. Start Firebase Emulator
# ---------------------------------------------------------------------------
firebase emulators:start --only auth,firestore,storage --project demo-dive-into-run &
EMULATOR_PID=$!

echo "Waiting for Firebase Emulator..."
for i in $(seq 1 60); do
  if curl -s http://localhost:9099/ > /dev/null 2>&1; then
    echo "Firebase Emulator ready."
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Emulator failed to start within 60s" >&2
    exit 1
  fi
  sleep 1
done

# ---------------------------------------------------------------------------
# 2. Start Next.js dev server with emulator env vars
# ---------------------------------------------------------------------------
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true \
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-dive-into-run \
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
FIRESTORE_EMULATOR_HOST=localhost:8080 \
FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 \
  npm run dev &
DEV_PID=$!

echo "Waiting for dev server on :3000..."
for i in $(seq 1 60); do
  if curl -s http://localhost:3000/ > /dev/null 2>&1; then
    echo "Dev server ready."
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Dev server failed to start within 60s" >&2
    exit 1
  fi
  sleep 1
done

# Tell Playwright configs not to start their own webServer
export CI_E2E_SERVER_STARTED=true

# ---------------------------------------------------------------------------
# 3. Discover and run all E2E features
# ---------------------------------------------------------------------------
FAILED_FEATURES=()
PASSED=0
SKIPPED=0

for e2e_dir in specs/*/tests/e2e; do
  [ -d "$e2e_dir" ] || continue
  feature=$(echo "$e2e_dir" | cut -d'/' -f2)

  # Reset emulator state before each feature
  echo "Resetting emulator state..."
  curl -s -X DELETE "http://localhost:9099/emulator/v1/projects/demo-dive-into-run/accounts" || true
  curl -s -X DELETE "http://localhost:8080/emulator/v1/projects/demo-dive-into-run/databases/(default)/documents" || true

  echo ""
  echo "=========================================="
  echo "Running E2E: $feature"
  echo "=========================================="

  if E2E_FEATURE="$feature" npx playwright test \
    --config playwright.emulator.config.mjs; then
    echo "PASSED: $feature"
    PASSED=$((PASSED + 1))
  else
    echo "FAILED: $feature"
    FAILED_FEATURES+=("$feature")
  fi
done

# ---------------------------------------------------------------------------
# 4. Cleanup
# ---------------------------------------------------------------------------
kill $DEV_PID 2>/dev/null || true
kill $EMULATOR_PID 2>/dev/null || true

# ---------------------------------------------------------------------------
# 5. Summary
# ---------------------------------------------------------------------------
TOTAL=$((PASSED + ${#FAILED_FEATURES[@]}))
echo ""
echo "=========================================="
echo "E2E Summary: $PASSED/$TOTAL passed"
echo "=========================================="
if [ ${#FAILED_FEATURES[@]} -eq 0 ]; then
  echo "All features passed."
  exit 0
else
  echo "Failed features: ${FAILED_FEATURES[*]}"
  exit 1
fi
