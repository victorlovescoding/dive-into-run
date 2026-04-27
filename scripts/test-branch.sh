#!/usr/bin/env bash
# Run Vitest (unit + integration) only for current branch's changed test files
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

TEST_BASE_REF="${TEST_BASE_REF:-main}"
CHANGED_TESTS=()
CHANGED_TEST_COUNT=0

is_branch_test_file() {
  [[ "$1" =~ ^tests/(unit|integration|_helpers)/.*\.test\.(js|jsx)$ ]]
}

add_changed_test() {
  local path="$1"
  local existing

  [ -n "$path" ] || return 0
  is_branch_test_file "$path" || return 0

  if [ "$CHANGED_TEST_COUNT" -gt 0 ]; then
    for existing in "${CHANGED_TESTS[@]}"; do
      if [ "$existing" = "$path" ]; then
        return 0
      fi
    done
  fi

  CHANGED_TESTS+=("$path")
  CHANGED_TEST_COUNT=$((CHANGED_TEST_COUNT + 1))
}

collect_changed_tests() {
  local diff_output
  local path

  if ! diff_output=$(git diff --name-only "$TEST_BASE_REF...HEAD" -- 'tests/unit/**' 'tests/integration/**' 'tests/_helpers/**' 2>&1); then
    echo "Warning: could not diff $TEST_BASE_REF...HEAD for changed unit/integration tests." >&2
    if [ -n "$diff_output" ]; then
      echo "Warning: git diff output: $diff_output" >&2
    fi
    diff_output=""
  fi
  while IFS= read -r path; do
    add_changed_test "$path"
  done <<EOF
$diff_output
EOF

  diff_output=$(git diff --name-only --cached -- 'tests/unit/**' 'tests/integration/**' 'tests/_helpers/**' 2>/dev/null || true)
  while IFS= read -r path; do
    add_changed_test "$path"
  done <<EOF
$diff_output
EOF

  diff_output=$(git diff --name-only -- 'tests/unit/**' 'tests/integration/**' 'tests/_helpers/**' 2>/dev/null || true)
  while IFS= read -r path; do
    add_changed_test "$path"
  done <<EOF
$diff_output
EOF
}

collect_changed_tests

if [ "$CHANGED_TEST_COUNT" -eq 0 ]; then
  echo "No changed unit/integration tests from git diff $TEST_BASE_REF...HEAD, staged changes, or unstaged changes — skipping."
  exit 0
fi

echo "Changed unit/integration source: git diff $TEST_BASE_REF...HEAD + staged changes + unstaged changes"
echo ""

if [ "$MODE" = "list" ]; then
  echo "Would run vitest on:"
  printf '  - %s\n' "${CHANGED_TESTS[@]}"
  exit 0
fi

echo "Running vitest on:"
printf '  - %s\n' "${CHANGED_TESTS[@]}"
npx vitest run --project=browser "${CHANGED_TESTS[@]}"
