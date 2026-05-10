#!/usr/bin/env bash
# Run Vitest for current branch's changed browser and server test files
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
BROWSER_TESTS=()
BROWSER_TEST_COUNT=0
SERVER_TESTS=()
SERVER_TEST_COUNT=0
RUN_ALL_SERVER_RULES=0

is_browser_test_file() {
  [[ "$1" =~ ^tests/(unit|integration|_helpers)/.*\.test\.(js|jsx)$ ]]
}

is_server_test_file() {
  [[ "$1" =~ ^tests/server/.*\.test\.js$ ]]
}

is_server_rules_support_file() {
  [[ "$1" = "firestore.rules" || "$1" =~ ^tests/server/rules/.*\.js$ ]]
}

add_browser_test() {
  local path="$1"
  local existing

  [ -n "$path" ] || return 0

  if [ "$BROWSER_TEST_COUNT" -gt 0 ]; then
    for existing in "${BROWSER_TESTS[@]}"; do
      if [ "$existing" = "$path" ]; then
        return 0
      fi
    done
  fi

  BROWSER_TESTS+=("$path")
  BROWSER_TEST_COUNT=$((BROWSER_TEST_COUNT + 1))
}

add_server_test() {
  local path="$1"
  local existing

  [ -n "$path" ] || return 0

  if [ "$SERVER_TEST_COUNT" -gt 0 ]; then
    for existing in "${SERVER_TESTS[@]}"; do
      if [ "$existing" = "$path" ]; then
        return 0
      fi
    done
  fi

  SERVER_TESTS+=("$path")
  SERVER_TEST_COUNT=$((SERVER_TEST_COUNT + 1))
}

add_changed_path() {
  local path="$1"

  [ -n "$path" ] || return 0

  if is_browser_test_file "$path"; then
    add_browser_test "$path"
  elif is_server_test_file "$path"; then
    add_server_test "$path"
  elif is_server_rules_support_file "$path"; then
    RUN_ALL_SERVER_RULES=1
  fi
}

# Extract destination paths from `git diff -M --name-status`, dropping pure
# renames (R<sim>) so directory moves don't trigger the entire suite. Pathspec
# is omitted from `git diff` because it disables rename pairing — paths are
# filtered afterwards via add_changed_path.
extract_changed_paths() {
  awk -F'\t' '/^R[0-9]+\t/ { next } /^[AM]\t/ { print $2 }'
}

collect_changed_tests() {
  local diff_output
  local filtered
  local path

  if ! diff_output=$(git diff -M --name-status "$TEST_BASE_REF...HEAD" 2>&1); then
    echo "Warning: could not diff $TEST_BASE_REF...HEAD for changed unit/integration tests." >&2
    if [ -n "$diff_output" ]; then
      echo "Warning: git diff output: $diff_output" >&2
    fi
    diff_output=""
  fi
  filtered=$(printf '%s\n' "$diff_output" | extract_changed_paths)
  while IFS= read -r path; do
    add_changed_path "$path"
  done <<EOF
$filtered
EOF

  diff_output=$(git diff -M --name-status --cached 2>/dev/null || true)
  filtered=$(printf '%s\n' "$diff_output" | extract_changed_paths)
  while IFS= read -r path; do
    add_changed_path "$path"
  done <<EOF
$filtered
EOF

  diff_output=$(git diff -M --name-status 2>/dev/null || true)
  filtered=$(printf '%s\n' "$diff_output" | extract_changed_paths)
  while IFS= read -r path; do
    add_changed_path "$path"
  done <<EOF
$filtered
EOF
}

collect_changed_tests

if [ "$BROWSER_TEST_COUNT" -eq 0 ] && [ "$SERVER_TEST_COUNT" -eq 0 ] && [ "$RUN_ALL_SERVER_RULES" -eq 0 ]; then
  echo "No changed browser/server tests from git diff $TEST_BASE_REF...HEAD, staged changes, or unstaged changes — skipping."
  exit 0
fi

echo "Changed test source: git diff $TEST_BASE_REF...HEAD + staged changes + unstaged changes"
echo ""

if [ "$MODE" = "list" ]; then
  echo "Would run browser vitest on:"
  if [ "$BROWSER_TEST_COUNT" -eq 0 ]; then
    echo "  - (none)"
  else
    printf '  - %s\n' "${BROWSER_TESTS[@]}"
  fi

  echo "Would run server vitest on:"
  if [ "$RUN_ALL_SERVER_RULES" -eq 1 ]; then
    echo "  - tests/server/rules"
  elif [ "$SERVER_TEST_COUNT" -eq 0 ]; then
    echo "  - (none)"
  else
    printf '  - %s\n' "${SERVER_TESTS[@]}"
  fi
  exit 0
fi

if [ "$BROWSER_TEST_COUNT" -gt 0 ]; then
  echo "Running browser vitest on:"
  printf '  - %s\n' "${BROWSER_TESTS[@]}"
  npx vitest run --project=browser "${BROWSER_TESTS[@]}"
fi

if [ "$RUN_ALL_SERVER_RULES" -eq 1 ]; then
  echo "Running server vitest on:"
  echo "  - tests/server/rules"
  npm run test:server -- tests/server/rules
elif [ "$SERVER_TEST_COUNT" -gt 0 ]; then
  echo "Running server vitest on:"
  printf '  - %s\n' "${SERVER_TESTS[@]}"
  npm run test:server -- "${SERVER_TESTS[@]}"
fi
