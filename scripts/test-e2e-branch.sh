#!/usr/bin/env bash
# Run Playwright E2E for current branch's changed spec files
set -euo pipefail

MODE="run"
if [ "${1:-}" = "--dry-run" ] || [ "${1:-}" = "--list" ]; then
  MODE="list"
  shift
fi

if [ $# -gt 0 ]; then
  echo "Usage: $0 [--dry-run|--list]" >&2
  exit 2
fi

FEATURE_ORDER=(
  "001-event-filtering"
  "004-event-edit-delete"
  "005-event-comments"
  "014-notification-system"
  "019-posts-ui-refactor"
  "028"
)

TEST_BASE_REF="${TEST_BASE_REF:-main}"
CHANGED_SPECS=()
CHANGED_SPEC_COUNT=0

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

setup_for_feature() {
  echo "tests/e2e/_setup/$1-global-setup.js"
}

is_vanilla_spec() {
  case "$(basename "$1")" in
    comment-notifications.spec.js | \
      events-page.spec.js | \
      events.spec.js | \
      run-calendar.spec.js | \
      weather-page.spec.js)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_e2e_spec_file() {
  [[ "$1" =~ ^tests/e2e/.*\.spec\.(js|jsx)$ ]]
}

add_changed_spec() {
  local path="$1"
  local existing

  [ -n "$path" ] || return 0
  is_e2e_spec_file "$path" || return 0

  if [ "$CHANGED_SPEC_COUNT" -gt 0 ]; then
    for existing in "${CHANGED_SPECS[@]}"; do
      if [ "$existing" = "$path" ]; then
        return 0
      fi
    done
  fi

  CHANGED_SPECS+=("$path")
  CHANGED_SPEC_COUNT=$((CHANGED_SPEC_COUNT + 1))
}

# Extract destination paths from `git diff -M --name-status` output, dropping
# pure renames (R<sim>) so a directory move (e.g. specs/<NNN>/tests/e2e/* →
# tests/e2e/*) does not trigger the entire E2E suite. Pathspec is intentionally
# omitted from `git diff` because it disables rename pairing — we filter paths
# afterwards.
extract_changed_paths() {
  awk -F'\t' '/^R[0-9]+\t/ { next } /^[AM]\t/ { print $2 }'
}

collect_changed_specs() {
  local diff_output
  local filtered
  local path

  if ! diff_output=$(git diff -M --name-status "$TEST_BASE_REF...HEAD" 2>&1); then
    echo "Warning: could not diff $TEST_BASE_REF...HEAD for changed E2E specs." >&2
    if [ -n "$diff_output" ]; then
      echo "Warning: git diff output: $diff_output" >&2
    fi
    diff_output=""
  fi
  filtered=$(printf '%s\n' "$diff_output" | extract_changed_paths)
  while IFS= read -r path; do
    add_changed_spec "$path"
  done <<EOF
$filtered
EOF

  diff_output=$(git diff -M --name-status --cached 2>/dev/null || true)
  filtered=$(printf '%s\n' "$diff_output" | extract_changed_paths)
  while IFS= read -r path; do
    add_changed_spec "$path"
  done <<EOF
$filtered
EOF

  diff_output=$(git diff -M --name-status 2>/dev/null || true)
  filtered=$(printf '%s\n' "$diff_output" | extract_changed_paths)
  while IFS= read -r path; do
    add_changed_spec "$path"
  done <<EOF
$filtered
EOF
}

is_top_level_e2e_spec() {
  case "${1#tests/e2e/}" in
    */*)
      return 1
      ;;
    *.spec.js | *.spec.jsx)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

changed_source="git diff $TEST_BASE_REF...HEAD + staged changes + unstaged changes"
if [ -n "${TEST_E2E_BRANCH_CHANGED_SPECS:-}" ]; then
  changed_source="TEST_E2E_BRANCH_CHANGED_SPECS"
  changed_specs_input="$TEST_E2E_BRANCH_CHANGED_SPECS"
  while IFS= read -r spec; do
    add_changed_spec "$spec"
  done <<EOF
$changed_specs_input
EOF
else
  collect_changed_specs
fi

if [ "$CHANGED_SPEC_COUNT" -eq 0 ]; then
  echo "No changed E2E specs from $changed_source — skipping."
  exit 0
fi

VANILLA_SPECS=()
VANILLA_SPEC_COUNT=0
UNKNOWN_SPECS=()
UNKNOWN_SPEC_COUNT=0

for spec in "${CHANGED_SPECS[@]}"; do
  if ! is_top_level_e2e_spec "$spec"; then
    UNKNOWN_SPECS+=("$spec")
    UNKNOWN_SPEC_COUNT=$((UNKNOWN_SPEC_COUNT + 1))
  elif feature_for_spec "$spec" > /dev/null; then
    :
  elif is_vanilla_spec "$spec"; then
    VANILLA_SPECS+=("$spec")
    VANILLA_SPEC_COUNT=$((VANILLA_SPEC_COUNT + 1))
  else
    UNKNOWN_SPECS+=("$spec")
    UNKNOWN_SPEC_COUNT=$((UNKNOWN_SPEC_COUNT + 1))
  fi
done

print_plan() {
  echo "Changed E2E source: $changed_source"
  echo ""
  echo "Seeded feature specs:"
  seeded_count=0
  for feature in "${FEATURE_ORDER[@]}"; do
    feature_specs=()
    feature_spec_count=0
    for spec in "${CHANGED_SPECS[@]}"; do
      spec_feature=$(feature_for_spec "$spec" 2>/dev/null || true)
      if [ "$spec_feature" = "$feature" ]; then
        feature_specs+=("$spec")
        feature_spec_count=$((feature_spec_count + 1))
      fi
    done
    if [ "$feature_spec_count" -eq 0 ]; then
      continue
    fi
    seeded_count=$((seeded_count + 1))
    echo "- $feature"
    echo "  setup: $(setup_for_feature "$feature")"
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
  if [ "$VANILLA_SPEC_COUNT" -eq 0 ]; then
    echo "- (none)"
  else
    echo "  setup: (none)"
    echo "  config: playwright.config.mjs"
    for spec in "${VANILLA_SPECS[@]}"; do
      echo "  - $spec"
    done
  fi

  if [ "$UNKNOWN_SPEC_COUNT" -gt 0 ]; then
    echo ""
    echo "Unknown specs:"
    for spec in "${UNKNOWN_SPECS[@]}"; do
      echo "  - $spec"
    done
  fi
}

print_plan

if [ "$UNKNOWN_SPEC_COUNT" -gt 0 ]; then
  echo "" >&2
  echo "Cannot infer setup for one or more changed E2E specs." >&2
  echo "Add a spec mapping to scripts/test-e2e-branch.sh, or run bash scripts/run-all-e2e.sh." >&2
  exit 1
fi

if [ "$MODE" = "list" ]; then
  exit 0
fi

# Wrap seeded runs in a single Firebase Emulator session. Seeded global-setup
# files use firebase-admin pointed at localhost emulator hosts; without an
# emulator they throw at verifyEmulatorRunning(). emulators:exec spawns the
# emulator, runs the inner command, then tears it down. INSIDE_EMULATOR_EXEC
# stops the wrap from recursing on the inner invocation.
needs_emulator() {
  local spec
  for spec in "${CHANGED_SPECS[@]}"; do
    if feature_for_spec "$spec" >/dev/null 2>&1; then
      return 0
    fi
  done
  return 1
}

if [ -z "${INSIDE_EMULATOR_EXEC:-}" ] && needs_emulator; then
  exec firebase emulators:exec --only auth,firestore,storage --project=demo-test \
    "INSIDE_EMULATOR_EXEC=1 bash $(printf '%q' "${BASH_SOURCE[0]}")"
fi

for feature in "${FEATURE_ORDER[@]}"; do
  feature_specs=()
  feature_spec_count=0
  for spec in "${CHANGED_SPECS[@]}"; do
    spec_feature=$(feature_for_spec "$spec" 2>/dev/null || true)
    if [ "$spec_feature" = "$feature" ]; then
      feature_specs+=("$spec")
      feature_spec_count=$((feature_spec_count + 1))
    fi
  done
  if [ "$feature_spec_count" -eq 0 ]; then
    continue
  fi
  E2E_FEATURE="$feature" npx playwright test \
    --config playwright.emulator.config.mjs \
    "${feature_specs[@]}"
done

if [ "$VANILLA_SPEC_COUNT" -gt 0 ]; then
  npx playwright test --config playwright.config.mjs "${VANILLA_SPECS[@]}"
fi
