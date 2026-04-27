#!/usr/bin/env bash
# Run ALL E2E tests across the entire repo (CI-only script).
# Starts Firebase Emulator + dev server once, then loops every feature.
set -euo pipefail

# ---------------------------------------------------------------------------
# 1. Start Firebase Emulator
# ---------------------------------------------------------------------------
firebase emulators:start --only auth,firestore,storage --project dive-into-run &
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

# Loop every feature globalSetup file under tests/e2e/_setup/
# Each *-global-setup.js corresponds to a feature → run with emulator config
for setup in tests/e2e/_setup/*-global-setup.js; do
  [ -f "$setup" ] || continue
  feature=$(basename "$setup" -global-setup.js)

  # Reset emulator state before each feature (wait for completion)
  echo "Resetting emulator state..."
  auth_status=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "http://localhost:9099/emulator/v1/projects/dive-into-run/accounts")
  fs_status=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "http://localhost:8080/emulator/v1/projects/dive-into-run/databases/(default)/documents")
  if [ "$auth_status" != "200" ]; then echo "  Warning: Auth cleanup returned $auth_status"; fi
  if [ "$fs_status" != "200" ]; then echo "  Warning: Firestore cleanup returned $fs_status"; fi
  sleep 1  # Let emulator finish internal cleanup

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

# Run any vanilla E2E specs (no globalSetup, don't need emulator)
if find tests/e2e -maxdepth 1 -name '*.spec.js' 2>/dev/null | head -1 | grep -q .; then
  echo ""
  echo "=========================================="
  echo "Running vanilla E2E specs (no globalSetup)"
  echo "=========================================="
  if npx playwright test --config playwright.config.mjs; then
    echo "PASSED: vanilla"
    PASSED=$((PASSED + 1))
  else
    echo "FAILED: vanilla"
    FAILED_FEATURES+=("vanilla")
  fi
fi

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
