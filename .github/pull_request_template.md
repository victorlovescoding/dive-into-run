<!--
  GitHub renders this template into the PR description editor for new PRs
  whose base branch contains this file. Author: fill in Summary / Verification
  / Related. Test gates are temporarily disabled for the testless reset.
-->

## Summary

<!--
  1-3 bullet points: the why, the what, and any cross-cutting impact.
	  Example:
	  - Disable test gates during the testless reset.
	  - Keep lint/type/build gates active.
-->

## Verification

<!--
	  Bulleted checklist of the non-test verifications you ran locally + on CI.
	  Test commands are intentionally disabled during the testless reset.
-->

- [ ] `npm run lint` / `npm run type-check` / `npm run spellcheck` green
- [ ] `npm run depcruise` / `npm run workflow:check` / `npm run workflow:links` green
- [ ] `npm run build` green

## Related

<!--
  Links: closing issues, spec directory, audit report, related PRs.
  Example:
  - Closes #NN
  - Spec: specs/0XX-feature-slug/
	  - Depends on: #MM
-->
