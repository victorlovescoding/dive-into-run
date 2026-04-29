#!/usr/bin/env bash
# S4 audit gate: warn (don't block) on integration tests that mock @/{repo,service,runtime}/.
# Refs: project-health/2026-04-29-tests-audit-report.md L77-111 (P0-1), L607-612 (S4)
# exit 0 (warn-only). S8 trigger: change to exit 1 after Wave 3 mock cleanup.

set +e

PATTERN='vi\.mock\(['\''"]@/(repo|service|runtime)/'
SEARCH_PATH='tests/integration'

if [ ! -d "$SEARCH_PATH" ]; then
  echo "AUDIT MOCK-BOUNDARY: 0 findings (skipped: no $SEARCH_PATH)"
  echo "(warn-only; exit 0)"
  exit 0
fi

findings=$(grep -rEn "$PATTERN" "$SEARCH_PATH" --include='*.test.*' 2>/dev/null || true)
files=$(grep -rEln "$PATTERN" "$SEARCH_PATH" --include='*.test.*' 2>/dev/null | sort -u || true)
if [ -z "$files" ]; then
  count=0
else
  count=$(printf '%s\n' "$files" | grep -c .)
fi

echo "AUDIT MOCK-BOUNDARY: $count findings"
if [ "$count" -gt 0 ] && [ -n "$findings" ]; then
  line_count=$(printf '%s\n' "$findings" | grep -c .)
  printf '%s\n' "$findings" | head -50
  if [ "$line_count" -gt 50 ]; then
    echo "... ($((line_count - 50)) more line(s); run \`grep -rEn \"$PATTERN\" $SEARCH_PATH --include='*.test.*'\` for full list)"
  fi
fi
echo "(warn-only; exit 0)"
exit 0
