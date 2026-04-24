#!/usr/bin/env bash

set -euo pipefail

input="${1-}"
base_branch="${2-main}"
editor="${3-code}"

if [[ -z "${input}" ]]; then
  echo "ERROR: missing worktree description"
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "${repo_root}"

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g'
}

compute_specs_max() {
  if [[ ! -d specs ]]; then
    echo 0
    return
  fi

  find specs -mindepth 1 -maxdepth 1 -type d -exec basename {} \; 2>/dev/null \
    | awk -F- '/^[0-9]{3}-/ { n = $1 + 0; if (n > max) max = n } END { print max + 0 }'
}

compute_worktree_max() {
  git worktree list --porcelain \
    | awk '
      /^branch refs\/heads\/[0-9]{3}-/ {
        sub(/^branch refs\/heads\//, "", $0)
        split($0, parts, "-")
        n = parts[1] + 0
        if (n > max) max = n
      }
      END { print max + 0 }
    '
}

resolve_name() {
  local raw="$1"
  local specs_max worktree_max next_num description

  if [[ "${raw}" =~ ^[0-9]{3}- ]]; then
    printf '%s\n' "${raw}"
    return
  fi

  if [[ "${raw}" =~ ^(chore|fix|hotfix)/ ]]; then
    printf '%s\n' "${raw}"
    return
  fi

  description="$(slugify "${raw}")"
  if [[ -z "${description}" ]]; then
    echo "ERROR: could not derive worktree name from input '${raw}'" >&2
    exit 1
  fi

  specs_max="$(compute_specs_max)"
  worktree_max="$(compute_worktree_max)"
  if (( specs_max > worktree_max )); then
    next_num=$((specs_max + 1))
  else
    next_num=$((worktree_max + 1))
  fi

  printf '%03d-%s\n' "${next_num}" "${description}"
}

name="$(resolve_name "${input}")"
path_name="${name//\//-}"
target="../dive-into-run-${path_name}"
install_log="/tmp/dive-into-run-${path_name}-npm-install.log"

git worktree add "${target}" -b "${name}" "${base_branch}"

if [[ -f .env ]]; then
  cp .env "${target}/.env"
else
  echo "WARN: .env not found, skipped copy" >&2
fi

editor_status="${editor}"
if [[ "${editor}" == "antigravity" ]]; then
  if ! antigravity "${target}" >/dev/null 2>&1; then
    echo "WARN: failed to launch antigravity" >&2
    editor_status="antigravity (failed)"
  fi
else
  if ! code "${target}" >/dev/null 2>&1; then
    echo "WARN: failed to launch VS Code" >&2
    editor_status="code (failed)"
  fi
fi

(
  cd "${target}"
  nohup npm install >"${install_log}" 2>&1 </dev/null &
) &

echo "Worktree: ${target}"
echo "Branch: ${name} (based on ${base_branch})"
echo "Editor: ${editor_status}"
echo "npm install: running..."
