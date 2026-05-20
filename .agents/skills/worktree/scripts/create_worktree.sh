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

extract_work_item_numbers() {
  sed -nE 's#^(.*/)?([0-9]{3})-[A-Za-z0-9].*#\2#p'
}

max_number() {
  awk '{ n = $1 + 0; if (n > max) max = n } END { print max + 0 }'
}

list_worktree_paths() {
  git worktree list --porcelain \
    | awk '/^worktree / { sub(/^worktree /, "", $0); print }'
}

compute_legacy_specs_max() {
  list_worktree_paths \
    | while IFS= read -r worktree_path; do
        if [[ -d "${worktree_path}/specs" ]]; then
          find "${worktree_path}/specs" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; 2>/dev/null
        fi
      done \
    | extract_work_item_numbers \
    | max_number
}

compute_branch_max() {
  {
    git for-each-ref --format='%(refname:short)' refs/heads refs/remotes 2>/dev/null
    git worktree list --porcelain \
      | awk '/^branch / { sub(/^branch refs\/heads\//, "", $0); print }'
  } \
    | extract_work_item_numbers \
    | max_number
}

compute_next_number() {
  local branch_max specs_max

  branch_max="$(compute_branch_max)"
  specs_max="$(compute_legacy_specs_max)"
  if (( branch_max > specs_max )); then
    echo $((branch_max + 1))
  else
    echo $((specs_max + 1))
  fi
}

resolve_name() {
  local raw="$1"
  local next_num description

  if [[ "${raw}" =~ ^([^/]+/)*[0-9]{3}- ]]; then
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

  next_num="$(compute_next_number)"

  printf '%03d-%s\n' "${next_num}" "${description}"
}

refresh_remote_branch_refs() {
  if git remote get-url origin >/dev/null 2>&1; then
    git fetch origin '+refs/heads/*:refs/remotes/origin/*'
  fi
}

resolve_base_ref() {
  local base="$1"

  refresh_remote_branch_refs

  if [[ "${base}" == "main" ]]; then
    printf '%s\n' "origin/main"
    return
  fi

  printf '%s\n' "${base}"
}

base_ref="$(resolve_base_ref "${base_branch}")"
name="$(resolve_name "${input}")"
path_name="${name//\//-}"
target="../dive-into-run-${path_name}"
install_log="/tmp/dive-into-run-${path_name}-npm-install.log"

git worktree add "${target}" -b "${name}" "${base_ref}"

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
echo "Branch: ${name} (based on ${base_ref})"
echo "Editor: ${editor_status}"
echo "npm install: running..."
