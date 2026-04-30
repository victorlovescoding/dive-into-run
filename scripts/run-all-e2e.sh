#!/usr/bin/env bash
# Run ALL E2E tests across the entire repo (CI-only script).
# Starts Firebase Emulator + dev server once, then loops every feature.
set -euo pipefail

MODE="run"
if [ "${1:-}" = "--list" ] || [ "${1:-}" = "--dry-run" ]; then
  MODE="list"
  shift
fi

if [ $# -gt 0 ]; then
  echo "Usage: $0 [--list|--dry-run]" >&2
  exit 2
fi

specs_for_feature() {
  case "$1" in
    001-event-filtering)
      echo "tests/e2e/event-filtering.spec.js"
      ;;
    004-event-edit-delete)
      echo "tests/e2e/event-edit-delete.spec.js"
      ;;
    005-event-comments)
      echo "tests/e2e/event-comments.spec.js"
      ;;
    014-notification-system)
      echo "tests/e2e/comment-notification-flow.spec.js"
      echo "tests/e2e/notification-flow.spec.js"
      ;;
    019-posts-ui-refactor)
      echo "tests/e2e/posts-ui.spec.js"
      ;;
    028)
      echo "tests/e2e/strava-oauth-flow.spec.js"
      ;;
    *)
      return 1
      ;;
  esac
}

feature_for_spec() {
  case "$(basename "$1")" in
    event-filtering.spec.js)
      echo "001-event-filtering"
      ;;
    event-edit-delete.spec.js)
      echo "004-event-edit-delete"
      ;;
    event-comments.spec.js)
      echo "005-event-comments"
      ;;
    comment-notification-flow.spec.js | notification-flow.spec.js)
      echo "014-notification-system"
      ;;
    posts-ui.spec.js)
      echo "019-posts-ui-refactor"
      ;;
    strava-oauth-flow.spec.js)
      echo "028"
      ;;
    *)
      return 1
      ;;
  esac
}

discover_features() {
  for setup in tests/e2e/_setup/*-global-setup.js; do
    [ -f "$setup" ] || continue
    basename "$setup" -global-setup.js
  done
}

discover_vanilla_specs() {
  find tests/e2e -maxdepth 1 -name '*.spec.js' -print 2>/dev/null | sort | while IFS= read -r spec; do
    if feature_for_spec "$spec" > /dev/null; then
      continue
    fi
    echo "$spec"
  done
}

print_plan() {
  echo "E2E run-all plan:"
  echo ""
  echo "Seeded feature specs:"
  seeded_count=0
  for feature in "${FEATURES[@]}"; do
    feature_specs=()
    while IFS= read -r spec; do
      [ -n "$spec" ] || continue
      feature_specs+=("$spec")
    done <<EOF
$(specs_for_feature "$feature" 2>/dev/null || true)
EOF
    if [ ${#feature_specs[@]} -eq 0 ]; then
      echo "No spec mapping for setup feature '$feature'." >&2
      echo "Add it to scripts/run-all-e2e.sh before running." >&2
      exit 1
    fi
    seeded_count=$((seeded_count + 1))
    echo "- $feature"
    echo "  setup: tests/e2e/_setup/$feature-global-setup.js"
    echo "  config: playwright.emulator.config.mjs"
    echo "  specs:"
    for spec in "${feature_specs[@]}"; do
      echo "    - $spec"
    done
  done
  if [ "$seeded_count" -eq 0 ]; then
    echo "- (none)"
  fi

  echo ""
  echo "Vanilla specs:"
  if [ ${#VANILLA_SPECS[@]} -eq 0 ]; then
    echo "- (none)"
  else
    echo "  setup: (none)"
    echo "  config: playwright.config.mjs"
    for spec in "${VANILLA_SPECS[@]}"; do
      echo "  - $spec"
    done
  fi
}

validate_plan() {
  for feature in "${FEATURES[@]}"; do
    feature_specs=()
    while IFS= read -r spec; do
      [ -n "$spec" ] || continue
      feature_specs+=("$spec")
    done <<EOF
$(specs_for_feature "$feature" 2>/dev/null || true)
EOF
    if [ ${#feature_specs[@]} -eq 0 ]; then
      echo "No spec mapping for setup feature '$feature'." >&2
      echo "Add it to scripts/run-all-e2e.sh before running." >&2
      exit 1
    fi
  done
}

FEATURES=()
while IFS= read -r feature; do
  [ -n "$feature" ] || continue
  FEATURES+=("$feature")
done <<EOF
$(discover_features)
EOF

VANILLA_SPECS=()
while IFS= read -r spec; do
  [ -n "$spec" ] || continue
  VANILLA_SPECS+=("$spec")
done <<EOF
$(discover_vanilla_specs)
EOF

if [ "$MODE" = "list" ]; then
  print_plan
  exit 0
fi

validate_plan

# ---------------------------------------------------------------------------
# 1. Start Firebase Emulator
# ---------------------------------------------------------------------------
firebase emulators:start --only auth,firestore,storage --project=demo-test &
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
# Each *-global-setup.js corresponds to a mapped feature spec subset.
for feature in "${FEATURES[@]}"; do
  feature_specs=()
  while IFS= read -r spec; do
    [ -n "$spec" ] || continue
    feature_specs+=("$spec")
  done <<EOF
$(specs_for_feature "$feature" 2>/dev/null || true)
EOF

  if [ ${#feature_specs[@]} -eq 0 ]; then
    echo "No spec mapping for setup feature '$feature'." >&2
    echo "Add it to scripts/run-all-e2e.sh before running." >&2
    exit 1
  fi

  # Reset emulator state before each feature (wait for completion)
  echo "Resetting emulator state..."
  auth_status=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "http://localhost:9099/emulator/v1/projects/demo-test/accounts")
  fs_status=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "http://localhost:8080/emulator/v1/projects/demo-test/databases/(default)/documents")
  if [ "$auth_status" != "200" ]; then echo "  Warning: Auth cleanup returned $auth_status"; fi
  if [ "$fs_status" != "200" ]; then echo "  Warning: Firestore cleanup returned $fs_status"; fi
  sleep 1  # Let emulator finish internal cleanup

  echo ""
  echo "=========================================="
  echo "Running E2E: $feature"
  echo "=========================================="

  if E2E_FEATURE="$feature" npx playwright test \
    --config playwright.emulator.config.mjs \
    "${feature_specs[@]}"; then
    echo "PASSED: $feature"
    PASSED=$((PASSED + 1))
  else
    echo "FAILED: $feature"
    FAILED_FEATURES+=("$feature")
  fi
done

# Run any vanilla E2E specs (no globalSetup, don't need emulator)
if [ ${#VANILLA_SPECS[@]} -gt 0 ]; then
  echo ""
  echo "=========================================="
  echo "Running vanilla E2E specs (no globalSetup)"
  echo "=========================================="
  if npx playwright test --config playwright.config.mjs "${VANILLA_SPECS[@]}"; then
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
