# Gap G Specs Index Plan

## Approach

This is a minimal docs navigation change. The implementation writes a new `specs/INDEX.md` from the provided Gap G inventory and creates durable 039 workflow artifacts so the coordinator or reviewer can resume without transcript context.

No executable tests are needed because there is no runtime behavior, build behavior, script behavior, or source code change. Verification is limited to JSON parsing, markdown diff checks, placeholder scans, and changed-file scope review.

## File Responsibilities

| File | Responsibility |
| ---- | -------------- |
| `specs/INDEX.md` | Durable specs navigation index with status legend and the requested minimal columns. |
| `specs/039-gap-g-specs-index/spec.md` | WHAT/WHY, requirements, non-goals, and acceptance criteria for Gap G. |
| `specs/039-gap-g-specs-index/plan.md` | Technical approach, file responsibilities, verification strategy, and risks. |
| `specs/039-gap-g-specs-index/tasks.md` | Task ownership, acceptance criteria, commands, and evidence placeholders. |
| `specs/039-gap-g-specs-index/handoff.md` | Current state, read order, latest evidence, blockers, and pitfalls. |
| `specs/039-gap-g-specs-index/status.json` | Machine-readable phase, active task, blocker state, completed tasks, and latest verification summary. |

## Verification Strategy

Run these checks from `/Users/chentzuyu/Desktop/dive-into-run-039-gap-g-specs-index`:

```bash
node -e "JSON.parse(require('fs').readFileSync('specs/039-gap-g-specs-index/status.json','utf8')); console.log('status.json ok')"
for f in specs/INDEX.md specs/039-gap-g-specs-index/*; do out="$(git diff --no-index --check -- /dev/null "$f" 2>&1 || true)"; test -z "$out" || { printf '%s\n' "$out"; exit 1; }; done
node -e "const fs=require('fs'),path=require('path');const roots=['specs/INDEX.md','specs/039-gap-g-specs-index'];const files=[];const walk=p=>fs.statSync(p).isDirectory()?fs.readdirSync(p).forEach(x=>walk(path.join(p,x))):files.push(p);roots.forEach(walk);const words=['PLACEHOLDER'+'_VALUE','REPLACE'+'_ME','FILL'+'_ME','T'+'BD','TO'+'DO'];let bad=false;for(const f of files){fs.readFileSync(f,'utf8').split(/\n/).forEach((line,i)=>{for(const w of words){if(line.includes(w)){console.log(f+':'+(i+1)+': '+w);bad=true;}}});}process.exit(bad?1:0);"
git status --short -- specs/INDEX.md specs/039-gap-g-specs-index
```

Expected results:

- `status.json` parses.
- The no-index diff check reports no whitespace errors for untracked docs files.
- Placeholder scan has no hits.
- `git status --short` reports only the owned write set.

## Risks And Controls

- `project-health/` is absent in this worktree because it is ignored. Read the Gap G source from the original checkout absolute path only.
- Status labels are historical and partly evidence-limited. Use the provided conservative labels instead of inventing stronger states.
- Do not expand scope into onboarding docs, workflow docs, generators, or CI. Gap G requested the minimal version only.
