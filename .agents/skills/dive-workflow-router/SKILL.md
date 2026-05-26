---
name: dive-workflow-router
description: Use when a user shows repo-changing intent in English or Chinese, including develop, implement, fix, refactor, document, 開發, 實作, 修, 修正, 修 bug, 重構, 改文件, or 更新文件. Reminds agents to route through this repo's workflow before planning, dispatching, or editing.
---

# Dive Workflow Router

When this skill triggers, do not treat the trigger as edit permission. It only
means the request has repo-changing intent and must use the repo workflow
router before planning, dispatching, or editing.

Read the source-of-truth docs instead of duplicating the workflow here:

- `AGENTS.md`
- `docs/superpowers/workflow.md`
- `docs/superpowers/task-profiles.md`
- `.codex/references/subagent-roles.md`

Minimum routing reminder:

1. Classify the request with `docs/superpowers/task-profiles.md`.
2. Confirm the authorization boundary before edits or closeout steps.
3. For a single clear P1/P2 slice, keep the minimum task brief inline.
4. For unclear or multi-slice P1/P2 work, dispatch Planner.
5. For P3/P4 work, dispatch Planner.
6. Route repo-changing edits Engineer-first and require Reviewer check per the
   repo docs.
