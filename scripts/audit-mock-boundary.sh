#!/usr/bin/env bash
# S8 audit gate: block tests that mock @/{lib,repo,service,runtime}/.
# Runtime provider mocks are allowed React boundaries and are excluded.
# Refs: project-health/2026-04-29-tests-audit-report.md L77-111 (P0-1), L607-612 (S4)
# S8 retired warn-only mode: no findings exit 0; findings > 0 exit 1.

set +e

PATTERN='vi\.mock\(['\''"]@/(lib|repo|service|runtime)/'
PROVIDERS_PATTERN='@/runtime/providers/'
SEARCH_PATH='tests'

if [ ! -d "$SEARCH_PATH" ]; then
  echo "AUDIT MOCK-BOUNDARY: 0 findings (skipped: no $SEARCH_PATH)"
  echo "(no findings; exit 0)"
  exit 0
fi

findings=$(grep -rEn "$PATTERN" "$SEARCH_PATH" --include='*.test.*' 2>/dev/null | grep -v "$PROVIDERS_PATTERN" || true)
files=$(grep -rEln "$PATTERN" "$SEARCH_PATH" --include='*.test.*' 2>/dev/null | grep -v "$PROVIDERS_PATTERN" | sort -u || true)
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
if [ "$count" -gt 0 ]; then
  echo "(blocking; exit 1)"
  exit 1
fi
echo "(no findings; exit 0)"
exit 0
