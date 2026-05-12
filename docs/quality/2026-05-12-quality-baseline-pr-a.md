# PR A Quality Baseline Collection

## Summary

PR A records a report-only quality baseline from the committed normalized JSON
at `config/quality-baseline-summary.json`. The collection window was
2026-05-12T05:05:31Z through 2026-05-12T05:12:37Z.

The source set contains 3 selected successful `main` Quality Budgets workflow
runs. All selected runs were `workflow_dispatch` runs on the same head SHA,
`cf5eee027269b6480bb0422247ec8974a6f66ab2`.

Raw artifact payloads and generated `reports/**` payloads are not committed.
This baseline is report-only and defines no hard thresholds, pass/fail budgets,
or CI gate behavior.

## Source Runs

| Run ID | Head SHA | Date (UTC) | Artifact name | Run URL |
| --- | --- | --- | --- | --- |
| 25714597130 | `cf5eee027269b6480bb0422247ec8974a6f66ab2` | 2026-05-12T05:12:33Z | `quality-budget-reports` | https://github.com/victorlovescoding/dive-into-run/actions/runs/25714597130 |
| 25714592676 | `cf5eee027269b6480bb0422247ec8974a6f66ab2` | 2026-05-12T05:12:27Z | `quality-budget-reports` | https://github.com/victorlovescoding/dive-into-run/actions/runs/25714592676 |
| 25714588719 | `cf5eee027269b6480bb0422247ec8974a6f66ab2` | 2026-05-12T05:12:37Z | `quality-budget-reports` | https://github.com/victorlovescoding/dive-into-run/actions/runs/25714588719 |

## Observed Metrics

| Metric | Samples | Median | Max | Unit / scale | Notes |
| --- | ---: | ---: | ---: | --- | --- |
| `knip.unusedFileCount` | 3 | 0 | 0 | count | Parsed from `knip-report.json` after removing a dotenv log prelude. Outliers not evaluated. |
| `knip.issueFileCount` | 3 | 46 | 46 | count | Parsed from `knip-report.json` after removing a dotenv log prelude. Outliers not evaluated. |
| `knip.unusedProductionDependencyCount` | 3 | 1 | 1 | count | Counts issue entries under the Knip dependencies key. Outliers not evaluated. |
| `knip.unlistedDependencyCount` | 3 | 6 | 6 | count | Counts issue entries under the Knip unlisted key. Outliers not evaluated. |
| `knip.unusedExportCount` | 3 | 52 | 52 | count | Counts issue entries under the Knip exports key. Outliers not evaluated. |
| `bundle.routeCount` | 3 | 16 | 16 | route count | Parsed from `reports/bundle-budget/next-build-budget.json`. Outliers not evaluated. |
| `bundle.warningCount` | 3 | 1 | 1 | warning count | Observed report-only bundle warning count; no enforcement decision. Outliers not evaluated. |
| `bundle.findingCount` | 3 | 0 | 0 | finding count | Parsed from `reports/bundle-budget/next-build-budget.json`. Outliers not evaluated. |
| `bundle.largestFirstLoadJsBytes` | 3 | 267,264 | 267,264 | bytes | Largest first-load route was `/events/[id]` in all selected runs. Outliers not evaluated. |
| `strictTypeCheck.exitCode` | 3 | 0 | 0 | exit code | Strict type-check report path signal was present in every selected artifact. Outliers not evaluated. |
| `lighthouse.runCount` | 3 | 9 | 9 | run count | Parsed from `lhci-report/manifest.json`. Outliers not evaluated. |
| `lighthouse.representativeRunCount` | 3 | 3 | 3 | run count | Representative URLs were `/`, `/events`, and `/weather` on localhost in every selected run. Outliers not evaluated. |
| `lighthouse.minimumRepresentativePerformanceScore` | 3 | 0.89 | 0.96 | ratio, 0-1 | Minimum representative performance scores were 0.89, 0.89, and 0.96. Outliers not evaluated. |

## Limitations

This baseline uses only three successful `workflow_dispatch` runs from `main`,
and all three runs use the same head SHA,
`cf5eee027269b6480bb0422247ec8974a6f66ab2`.

The JSON field `outlierEvaluation` is `not_evaluated`. PR A records normalized
observations only; it does not decide whether any metric is an outlier.

Raw artifacts, downloaded report payloads, and generated `reports/**` files are
not committed, so this document intentionally summarizes normalized values
rather than duplicating raw artifact JSON.

## Future Gate Handoff

Future PRs may consume `config/quality-baseline-summary.json` as input for
quality gates, but PR A does not enforce gates. Any future threshold,
pass/fail, budget, or outlier rule must be defined explicitly in that future
work before it blocks CI or review.

## Verification

Fresh verification for this task:

| Command | Result |
| --- | --- |
| `node -e "JSON.parse(require('node:fs').readFileSync('config/quality-baseline-summary.json', 'utf8')); console.log('json ok')"` | `json ok` |
| `git status --short --branch` | Branch `050-quality-baseline-pr-a...origin/main [ahead 3]`; changed file for this task is `docs/quality/2026-05-12-quality-baseline-pr-a.md`. |

No `project-health/**`, raw reports, `reports/**`, config JSON, scripts, tests,
workflows, package files, dependencies, lockfiles, or app code were written by
this task.
