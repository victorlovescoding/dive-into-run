# Legacy Superpowers Outputs

This directory stores historical Superpowers plugin outputs migrated from the
old plugin default paths:

- `docs/superpowers/specs/`
- `docs/superpowers/plans/`

These files are lookup-only and provenance-only. They are not active workflow
state, not resume entrypoints, and not defaults for new work.

Do not treat any file under `specs/_legacy/superpowers/**` as an active
`specs/<feature>/` workflow directory.

New P4 features must use the five-file workflow state under `specs/<feature>/`:

- `spec.md`
- `plan.md`
- `tasks.md`
- `handoff.md`
- `status.json`

P1 and P2 work defaults to no `specs/` artifacts. Keep evidence in the
conversation, task brief, and PR body unless the user explicitly asks for a
long-term repo doc.

P3 work creates compact durable artifacts only when the task crosses sessions,
has multiple tasks, or needs dispatcher continuity. Do not create the full
five-file set unless the task escalates to P4.
