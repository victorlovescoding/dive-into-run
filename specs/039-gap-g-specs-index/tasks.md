# Gap G Specs Index Tasks

## Compact Guard

- This file is the task source of truth for `specs/039-gap-g-specs-index/`.
- On resume, read `AGENTS.md`, `specs/039-gap-g-specs-index/handoff.md`, this file, `specs/039-gap-g-specs-index/status.json`, then `specs/INDEX.md`.
- This is docs-only. Do not touch production code, executable tests, scripts, package files, CI, hooks, `AGENTS.md`, `docs/superpowers/workflow.md`, or `project-health/`.
- Task completion requires reviewer confirmation unless explicitly recorded as engineer-only setup.

## Tasks

### T001 - Inventory Current Specs

- **Status**: `[x]`
- **Scope**: Use the provided Gap G inventory and source context to define rows, statuses, key files, and related specs.
- **Owned files**:
  - `specs/039-gap-g-specs-index/tasks.md`
  - `specs/039-gap-g-specs-index/handoff.md`
  - `specs/039-gap-g-specs-index/status.json`
- **Dependencies**: none
- **Engineer**: Gap G docs Engineer
- **Reviewer**: Gap G docs Reviewer
- **Commit checkpoint**: none

Acceptance criteria:

- AC-T001.1: Inventory includes every row provided for Gap G.
- AC-T001.2: Status labels are limited to the requested legend.
- AC-T001.3: Related entries stay concise and do not invent new dependencies.
- AC-T001.4: `Completed?` remains intentionally conservative for inconsistent or incomplete historical evidence.

Verification commands:

```bash
test -f /Users/chentzuyu/Desktop/dive-into-run/project-health/2026-04-24-openai-harness-gap-analysis.md
sed -n '526,576p' /Users/chentzuyu/Desktop/dive-into-run/project-health/2026-04-24-openai-harness-gap-analysis.md
```

Engineer evidence:

- Completed from the provided Gap G row inventory and the source excerpt at `/Users/chentzuyu/Desktop/dive-into-run/project-health/2026-04-24-openai-harness-gap-analysis.md:526`.
- Confirmed `project-health/` is absent in this worktree, so source reading used the original checkout absolute path.

Reviewer evidence:

- Covered by final docs reviewer PASS: provided inventory rows were represented in `specs/INDEX.md` with conservative status labels and no expanded scope.

### T002 - Create Specs Index And 039 Docs

- **Status**: `[x]`
- **Scope**: Create `specs/INDEX.md` and the 039 spec, plan, task, handoff, and status artifacts.
- **Owned files**:
  - `specs/INDEX.md`
  - `specs/039-gap-g-specs-index/spec.md`
  - `specs/039-gap-g-specs-index/plan.md`
  - `specs/039-gap-g-specs-index/tasks.md`
  - `specs/039-gap-g-specs-index/handoff.md`
  - `specs/039-gap-g-specs-index/status.json`
- **Dependencies**: T001
- **Engineer**: Gap G docs Engineer
- **Reviewer**: Gap G docs Reviewer
- **Commit checkpoint**: `docs(gap-g): add specs index`

Acceptance criteria:

- AC-T002.1: `specs/INDEX.md` starts with `# Specs Index`.
- AC-T002.2: Purpose states the index helps future agents find specs, status, and related decisions, and is not an executable test.
- AC-T002.3: Status legend includes all requested status labels.
- AC-T002.4: Table columns are exactly `Spec | Domain | Status | Summary | Key files | Related`.
- AC-T002.5: All requested rows are present.
- AC-T002.6: 039 workflow artifacts exist and stay docs-only.
- AC-T002.7: No non-owned file is modified.

Verification commands:

```bash
test -f specs/INDEX.md
test -f specs/039-gap-g-specs-index/spec.md
test -f specs/039-gap-g-specs-index/plan.md
test -f specs/039-gap-g-specs-index/tasks.md
test -f specs/039-gap-g-specs-index/handoff.md
test -f specs/039-gap-g-specs-index/status.json
git status --short -- specs/INDEX.md specs/039-gap-g-specs-index
```

Engineer evidence:

- Created `specs/INDEX.md` with the requested title, purpose, status legend, exact table columns, and provided rows.
- Created 039 `spec.md`, `plan.md`, `tasks.md`, `handoff.md`, and `status.json`.
- Write scope stayed inside the owned files.

Reviewer evidence:

- Covered by final docs reviewer PASS: `specs/INDEX.md` and 039 workflow artifacts stayed inside the owned write set and matched the minimal Gap G requirements.

### T003 - Verify And Review

- **Status**: `[ ]`
- **Scope**: Run docs verification, review changed scope, and decide whether the docs are ready for commit/PR closeout.
- **Owned files**:
  - `specs/INDEX.md`
  - `specs/039-gap-g-specs-index/spec.md`
  - `specs/039-gap-g-specs-index/plan.md`
  - `specs/039-gap-g-specs-index/tasks.md`
  - `specs/039-gap-g-specs-index/handoff.md`
  - `specs/039-gap-g-specs-index/status.json`
- **Dependencies**: T002
- **Engineer**: Gap G docs Engineer or coordinator
- **Reviewer**: Gap G docs Reviewer
- **Commit checkpoint**: `docs(gap-g): add specs index`

Acceptance criteria:

- AC-T003.1: `status.json` parses as valid JSON.
- AC-T003.2: The no-index diff check passes for untracked `specs/INDEX.md` and `specs/039-gap-g-specs-index`.
- AC-T003.3: Placeholder marker scan has no hits.
- AC-T003.4: `git status --short -- specs/INDEX.md specs/039-gap-g-specs-index` is limited to owned files.
- AC-T003.5: Reviewer confirms the index uses only the requested statuses and columns.

Verification commands:

```bash
node -e "JSON.parse(require('fs').readFileSync('specs/039-gap-g-specs-index/status.json','utf8')); console.log('status.json ok')"
for f in specs/INDEX.md specs/039-gap-g-specs-index/*; do out="$(git diff --no-index --check -- /dev/null "$f" 2>&1 || true)"; test -z "$out" || { printf '%s\n' "$out"; exit 1; }; done
node -e "const fs=require('fs'),path=require('path');const roots=['specs/INDEX.md','specs/039-gap-g-specs-index'];const files=[];const walk=p=>fs.statSync(p).isDirectory()?fs.readdirSync(p).forEach(x=>walk(path.join(p,x))):files.push(p);roots.forEach(walk);const words=['PLACEHOLDER'+'_VALUE','REPLACE'+'_ME','FILL'+'_ME','T'+'BD','TO'+'DO'];let bad=false;for(const f of files){fs.readFileSync(f,'utf8').split(/\n/).forEach((line,i)=>{for(const w of words){if(line.includes(w)){console.log(f+':'+(i+1)+': '+w);bad=true;}}});}process.exit(bad?1:0);"
git status --short -- specs/INDEX.md specs/039-gap-g-specs-index
```

Engineer evidence:

- Ran docs verification after creation and cleanup:
  - `status.json` parse exit 0, output `status.json ok`.
  - Untracked-file no-index diff check exit 0 with no whitespace errors.
  - Placeholder marker scan exit 0 with no output after command examples were rewritten to avoid self-matching.
  - `git status --short` exit 0 with only `?? specs/039-gap-g-specs-index/` and `?? specs/INDEX.md`.

Reviewer evidence:

- Gap G final docs reviewer PASS: scope stayed limited to owned docs paths; `specs/INDEX.md` has the requested title, purpose, status legend, columns, current spec rows, and 039 row; 039 artifacts are internally consistent.
