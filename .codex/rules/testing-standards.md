# Testing Standards

Executable tests are temporarily removed for the testless reset.

Current policy:

- Test-related commit, push, and CI gates are disabled.
- Test npm scripts print a disabled message and exit successfully.
- Non-test gates still apply: lint, type-check, dependency cruiser, spellcheck,
  workflow checks, useEffect data-fetch audit, and build.
- Do not treat disabled test commands as verification evidence.

When tests are reintroduced, rebuild this file before adding executable tests.
