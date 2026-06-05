#!/usr/bin/env bash

set -u

max_age_days=45

tracked_docs=(
  "AGENTS.md"
  ".codex/references/quality-gates.md"
  ".codex/references/review-standards.md"
)

if [[ -n "${DOC_FRESHNESS_ROOT:-}" ]]; then
  if [[ ! -d "$DOC_FRESHNESS_ROOT" ]]; then
    printf 'doc freshness: DOC_FRESHNESS_ROOT does not exist: %s\n' "$DOC_FRESHNESS_ROOT" >&2
    exit 1
  fi

  root="$(cd "$DOC_FRESHNESS_ROOT" && pwd)"
else
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  root="$(cd "$script_dir/.." && pwd)"
fi

failures=0

check_date() {
  local value="$1"

  node - "$value" "$max_age_days" <<'NODE'
const value = process.argv[2];
const maxAgeDays = Number(process.argv[3]);
const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

if (!match) {
  process.exit(2);
}

const year = Number(match[1]);
const month = Number(match[2]);
const day = Number(match[3]);
const verified = new Date(Date.UTC(year, month - 1, day));

if (
  verified.getUTCFullYear() !== year
  || verified.getUTCMonth() !== month - 1
  || verified.getUTCDate() !== day
) {
  process.exit(2);
}

const now = new Date();
const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
const ageDays = Math.floor((today - verified.getTime()) / 86400000);

if (ageDays > maxAgeDays) {
  process.exit(3);
}
NODE
}

for doc in "${tracked_docs[@]}"; do
  path="$root/$doc"

  if [[ ! -f "$path" ]]; then
    printf '%s: missing tracked doc\n' "$doc" >&2
    failures=$((failures + 1))
    continue
  fi

  metadata_count="$(grep -Ec '^> Last-Verified:' "$path" || true)"
  valid_count="$(grep -Ec '^> Last-Verified: [0-9]{4}-[0-9]{2}-[0-9]{2}$' "$path" || true)"

  if [[ "$metadata_count" -eq 0 ]]; then
    printf '%s: missing Last-Verified metadata\n' "$doc" >&2
    failures=$((failures + 1))
    continue
  fi

  if [[ "$metadata_count" -ne 1 || "$valid_count" -ne 1 ]]; then
    printf '%s: malformed Last-Verified metadata; expected exactly one line: > Last-Verified: YYYY-MM-DD\n' "$doc" >&2
    failures=$((failures + 1))
    continue
  fi

  metadata_line="$(grep -E '^> Last-Verified: [0-9]{4}-[0-9]{2}-[0-9]{2}$' "$path")"
  verified_date="${metadata_line#> Last-Verified: }"

  check_date "$verified_date"
  date_status=$?

  if [[ "$date_status" -eq 2 ]]; then
    printf '%s: malformed Last-Verified date: %s\n' "$doc" "$verified_date" >&2
    failures=$((failures + 1))
    continue
  fi

  if [[ "$date_status" -eq 3 ]]; then
    printf '%s: stale Last-Verified date older than %s days: %s\n' "$doc" "$max_age_days" "$verified_date" >&2
    failures=$((failures + 1))
    continue
  fi

  if [[ "$date_status" -ne 0 ]]; then
    printf '%s: unable to validate Last-Verified date: %s\n' "$doc" "$verified_date" >&2
    failures=$((failures + 1))
  fi
done

if [[ "$failures" -ne 0 ]]; then
  exit 1
fi

printf 'Doc freshness check passed for %s files.\n' "${#tracked_docs[@]}"
