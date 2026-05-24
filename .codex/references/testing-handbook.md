# Testing Handbook

> Last-Verified: 2026-05-24

The executable test suite is temporarily removed for the testless reset.

Current state:

- No executable test tree is present.
- Test-related npm scripts are disabled no-ops.
- Test-related commit, push, and CI gates are disabled.
- Non-test quality gates remain active.

Do not add test files by following historical paths in old specs or audit
reports. Rebuild the testing standards first, then introduce a replacement test
suite under the new approved policy.
