import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_OUT_DIR = 'reports/bundle-budget';
const DEFAULT_BASELINE_SUMMARY_PATH = 'config/quality-baseline-summary.json';
const ANSI_PATTERN = new RegExp(String.raw`\x1B\[[0-9;]*m`, 'g');
const ROUTE_LINE_PATTERN =
  /^[\s│├┌└─]+(?<kind>[○●ƒ])\s+(?<route>\S+)\s+(?<size>[0-9.]+)\s+(?<sizeUnit>[kM]?B)\s+(?<firstLoad>[0-9.]+)\s+(?<firstLoadUnit>[kM]?B)\s*$/u;
const SHARED_LINE_PATTERN =
  /^\+ First Load JS shared by all\s+(?<value>[0-9.]+)\s+(?<unit>[kM]?B)\s*$/u;

/**
 * @typedef {object} RouteMetric
 * @property {string} route - Next.js route path.
 * @property {string} kind - Next.js route rendering marker.
 * @property {number} sizeBytes - Route bundle size in bytes.
 * @property {number} firstLoadJsBytes - First Load JS size in bytes.
 */

/**
 * @typedef {object} ParsedBuildMetrics
 * @property {RouteMetric[]} routes - Route-level bundle metrics.
 * @property {number | null} sharedFirstLoadJsBytes - Shared First Load JS size in bytes.
 */

/**
 * @typedef {object} BudgetFinding
 * @property {'warning'} level - Report-only severity.
 * @property {string} route - Route path that exceeded the report-only threshold.
 * @property {string} metric - Budget metric name.
 * @property {number} actualBytes - Observed byte count.
 * @property {number} budgetBytes - Configured report-only budget in bytes.
 * @property {'global-env-budget' | 'route-policy-proposal'} policy - Report-only policy source.
 * @property {string} message - Human-readable finding details.
 */

/**
 * @typedef {object} ReportWarning
 * @property {string} code - Stable warning code for machines and Markdown.
 * @property {string} message - Human-readable warning details.
 */

/**
 * @typedef {object} BudgetConfigReport
 * @property {'configured' | 'partial' | 'missing'} status - Budget configuration completeness.
 * @property {number | null} maxFirstLoadJsBytes - First Load JS budget in bytes.
 * @property {number | null} maxRouteSizeBytes - Route size budget in bytes.
 * @property {{ BUNDLE_BUDGET_FIRST_LOAD_KB: 'configured' | 'unset', BUNDLE_BUDGET_ROUTE_SIZE_KB: 'configured' | 'unset' }} env - Per-variable status.
 */

/**
 * @typedef {object} RoutePolicyEntry
 * @property {'report-only'} mode - Policy mode; route-level proposals never block CI here.
 * @property {string} route - Route path from baseline evidence.
 * @property {'firstLoadJs'} metric - Route metric covered by the proposal.
 * @property {number} proposedBudgetBytes - Proposed report-only budget in bytes.
 * @property {number} baselineMaxBytes - Observed baseline max in bytes.
 * @property {number} sampleCount - Number of baseline samples for this route.
 * @property {string} sourceMetric - Baseline summary metric used to derive the proposal.
 * @property {string} rationale - Human-readable derivation note.
 */

/**
 * @typedef {object} RoutePolicyReport
 * @property {'configured' | 'missing' | 'invalid'} status - Route policy proposal status.
 * @property {string} sourcePath - Baseline summary path used for the proposal.
 * @property {RoutePolicyEntry[]} entries - Route-level report-only proposal entries.
 * @property {ReportWarning[]} warnings - Report-only route policy warnings.
 */

/**
 * @typedef {object} BudgetReport
 * @property {string} generatedAt - ISO timestamp for the report.
 * @property {'ok' | 'warning'} status - Overall report-only status.
 * @property {number} routeCount - Number of parsed routes.
 * @property {number | null} sharedFirstLoadJsBytes - Shared First Load JS size in bytes.
 * @property {{ route: string, firstLoadJsBytes: number } | null} largestFirstLoadRoute - Largest route by First Load JS.
 * @property {BudgetConfigReport} budgetConfig - Budget configuration report.
 * @property {RoutePolicyReport} routePolicy - Route-level report-only policy proposal.
 * @property {RouteMetric[]} routes - Route-level bundle metrics.
 * @property {BudgetFinding[]} findings - Report-only budget findings.
 * @property {ReportWarning[]} warnings - Report-only warning statuses.
 */

/**
 * Converts a Next.js build table size token into bytes.
 * @param {string} value - Numeric size value from the build output.
 * @param {string} unit - Size unit from the build output.
 * @returns {number} Rounded byte count.
 */
export function parseBuildSizeToBytes(value, unit) {
  const numericValue = Number(value);
  const multipliers = /** @type {Record<string, number>} */ ({
    B: 1,
    kB: 1024,
    MB: 1024 * 1024,
  });
  const multiplier = multipliers[unit] ?? 1;

  return Math.round(numericValue * multiplier);
}

/**
 * Extracts route-level bundle metrics from Next.js 15 build output.
 * @param {string} buildOutput - Raw `next build` stdout/stderr.
 * @returns {ParsedBuildMetrics} Parsed metrics.
 */
export function parseNextBuildRouteMetrics(buildOutput) {
  /** @type {RouteMetric[]} */
  const routes = [];
  let sharedFirstLoadJsBytes = null;

  for (const rawLine of buildOutput.replace(ANSI_PATTERN, '').split('\n')) {
    const line = rawLine.trimEnd();
    const routeMatch = ROUTE_LINE_PATTERN.exec(line);

    if (routeMatch?.groups) {
      routes.push({
        route: routeMatch.groups.route,
        kind: routeMatch.groups.kind,
        sizeBytes: parseBuildSizeToBytes(routeMatch.groups.size, routeMatch.groups.sizeUnit),
        firstLoadJsBytes: parseBuildSizeToBytes(
          routeMatch.groups.firstLoad,
          routeMatch.groups.firstLoadUnit
        ),
      });
      continue;
    }

    const sharedMatch = SHARED_LINE_PATTERN.exec(line);
    if (sharedMatch?.groups) {
      sharedFirstLoadJsBytes = parseBuildSizeToBytes(
        sharedMatch.groups.value,
        sharedMatch.groups.unit
      );
    }
  }

  return { routes, sharedFirstLoadJsBytes };
}

/**
 * Formats bytes as a compact KiB string for Markdown reports.
 * @param {number | null} bytes - Byte count to display.
 * @returns {string} Human-readable size.
 */
function formatBytes(bytes) {
  if (bytes === null) {
    return 'n/a';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} kB`;
}

/**
 * Parses optional report-only budgets from environment variables.
 * @param {Record<string, string | undefined>} env - Process environment.
 * @returns {BudgetConfigReport} Budget thresholds and configuration status.
 */
function readBudgets(env) {
  const maxFirstLoadJsBytes = parseOptionalKilobytes(env.BUNDLE_BUDGET_FIRST_LOAD_KB);
  const maxRouteSizeBytes = parseOptionalKilobytes(env.BUNDLE_BUDGET_ROUTE_SIZE_KB);
  const configuredCount = [maxFirstLoadJsBytes, maxRouteSizeBytes].filter(
    (budget) => budget !== null
  ).length;

  return {
    status:
      configuredCount === 2 ? 'configured' : configuredCount === 0 ? 'missing' : 'partial',
    maxFirstLoadJsBytes,
    maxRouteSizeBytes,
    env: {
      BUNDLE_BUDGET_FIRST_LOAD_KB:
        maxFirstLoadJsBytes === null ? 'unset' : 'configured',
      BUNDLE_BUDGET_ROUTE_SIZE_KB:
        maxRouteSizeBytes === null ? 'unset' : 'configured',
    },
  };
}

/**
 * Converts an optional KiB string to bytes.
 * @param {string | undefined} value - Environment value.
 * @returns {number | null} Byte threshold, or null when unset.
 */
function parseOptionalKilobytes(value) {
  if (!value) {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return Math.round(numericValue * 1024);
}

/**
 * Creates report-only budget findings for parsed route metrics.
 * @param {ParsedBuildMetrics} metrics - Parsed bundle metrics.
 * @param {{ maxFirstLoadJsBytes: number | null, maxRouteSizeBytes: number | null }} budgets - Optional thresholds.
 * @returns {BudgetFinding[]} Budget findings.
 */
function evaluateBudgets(metrics, budgets) {
  /** @type {BudgetFinding[]} */
  const findings = [];

  for (const route of metrics.routes) {
    if (
      budgets.maxFirstLoadJsBytes !== null &&
      route.firstLoadJsBytes > budgets.maxFirstLoadJsBytes
    ) {
      const actual = formatBytes(route.firstLoadJsBytes);
      const budget = formatBytes(budgets.maxFirstLoadJsBytes);
      findings.push({
        level: 'warning',
        route: route.route,
        metric: 'firstLoadJs',
        actualBytes: route.firstLoadJsBytes,
        budgetBytes: budgets.maxFirstLoadJsBytes,
        policy: 'global-env-budget',
        message: [
          `Report-only bundle budget warning: ${route.route} firstLoadJs ${actual}`,
          `exceeds configured env budget ${budget}.`,
          'This does not fail CI.',
        ].join(' '),
      });
    }

    if (budgets.maxRouteSizeBytes !== null && route.sizeBytes > budgets.maxRouteSizeBytes) {
      const actual = formatBytes(route.sizeBytes);
      const budget = formatBytes(budgets.maxRouteSizeBytes);
      findings.push({
        level: 'warning',
        route: route.route,
        metric: 'size',
        actualBytes: route.sizeBytes,
        budgetBytes: budgets.maxRouteSizeBytes,
        policy: 'global-env-budget',
        message: [
          `Report-only bundle budget warning: ${route.route} size ${actual}`,
          `exceeds configured env budget ${budget}.`,
          'This does not fail CI.',
        ].join(' '),
      });
    }
  }

  return findings;
}

/**
 * Reads route-level report-only policy proposals from the tracked baseline summary.
 * @param {string} baselineSummaryPath - Baseline summary JSON path.
 * @returns {RoutePolicyReport} Route policy proposal report.
 */
function readRoutePolicyProposal(baselineSummaryPath) {
  try {
    const summary = JSON.parse(readFileSync(baselineSummaryPath, 'utf8'));
    const largestFirstLoadMetric = summary?.metrics?.['bundle.largestFirstLoadJsBytes'];
    const samples = Array.isArray(largestFirstLoadMetric?.samples)
      ? largestFirstLoadMetric.samples
      : [];
    /** @type {Map<string, { baselineMaxBytes: number, sampleCount: number }>} */
    const routeSamples = new Map();

    for (const sample of samples) {
      if (typeof sample?.route !== 'string') {
        continue;
      }

      const value = Number(sample.value);
      if (!Number.isFinite(value) || value <= 0) {
        continue;
      }

      const existing = routeSamples.get(sample.route);
      const baselineMaxBytes =
        existing === undefined
          ? Math.round(value)
          : Math.max(existing.baselineMaxBytes, Math.round(value));
      routeSamples.set(sample.route, {
        baselineMaxBytes,
        sampleCount: (existing?.sampleCount ?? 0) + 1,
      });
    }

    /** @type {RoutePolicyEntry[]} */
    const entries = Array.from(routeSamples.entries()).map(([route, sample]) => ({
      mode: 'report-only',
      route,
      metric: 'firstLoadJs',
      proposedBudgetBytes: sample.baselineMaxBytes,
      baselineMaxBytes: sample.baselineMaxBytes,
      sampleCount: sample.sampleCount,
      sourceMetric: 'bundle.largestFirstLoadJsBytes',
      rationale:
        'Derived from baseline summary observed max with no automatic buffer; warning-only until manually reviewed.',
    }));

    if (entries.length === 0) {
      return {
        status: 'missing',
        sourcePath: baselineSummaryPath,
        entries,
        warnings: [
          {
            code: 'route-policy-proposal-missing',
            message:
              'No route-level bundle policy proposal could be derived from the baseline summary; this is report-only.',
          },
        ],
      };
    }

    return {
      status: 'configured',
      sourcePath: baselineSummaryPath,
      entries,
      warnings: [],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      status: 'invalid',
      sourcePath: baselineSummaryPath,
      entries: [],
      warnings: [
        {
          code: 'route-policy-baseline-unreadable',
          message: [
            `Could not read route-level policy baseline from ${baselineSummaryPath}:`,
            `${errorMessage}.`,
            'This is report-only.',
          ].join(' '),
        },
      ],
    };
  }
}

/**
 * Evaluates route-level report-only policy proposals against parsed route metrics.
 * @param {ParsedBuildMetrics} metrics - Parsed bundle metrics.
 * @param {RoutePolicyReport} routePolicy - Route-level policy proposal report.
 * @returns {{ findings: BudgetFinding[], warnings: ReportWarning[] }} Report-only findings and warnings.
 */
function evaluateRoutePolicy(metrics, routePolicy) {
  /** @type {BudgetFinding[]} */
  const findings = [];
  /** @type {ReportWarning[]} */
  const warnings = [];
  const routeByPath = new Map(metrics.routes.map((route) => [route.route, route]));

  for (const entry of routePolicy.entries) {
    const route = routeByPath.get(entry.route);

    if (route === undefined) {
      warnings.push({
        code: 'route-policy-route-missing',
        message: [
          `Route policy proposal references ${entry.route}, but that route was not parsed`,
          'from current build output; this is report-only.',
        ].join(' '),
      });
      continue;
    }

    if (route.firstLoadJsBytes > entry.proposedBudgetBytes) {
      const actual = formatBytes(route.firstLoadJsBytes);
      const budget = formatBytes(entry.proposedBudgetBytes);
      findings.push({
        level: 'warning',
        route: route.route,
        metric: entry.metric,
        actualBytes: route.firstLoadJsBytes,
        budgetBytes: entry.proposedBudgetBytes,
        policy: 'route-policy-proposal',
        message: [
          `Report-only route policy proposal warning: ${route.route} ${entry.metric} ${actual}`,
          `exceeds baseline proposal ${budget} from ${entry.sourceMetric}.`,
          'This does not fail CI.',
        ].join(' '),
      });
    }
  }

  return { findings, warnings };
}

/**
 * Creates report-only warnings for missing metrics or budget configuration.
 * @param {ParsedBuildMetrics} metrics - Parsed bundle metrics.
 * @param {BudgetConfigReport} budgetConfig - Budget configuration report.
 * @param {ReportWarning[]} routePolicyWarnings - Route policy warnings.
 * @returns {ReportWarning[]} Report-only warnings.
 */
function createReportWarnings(metrics, budgetConfig, routePolicyWarnings) {
  /** @type {ReportWarning[]} */
  const warnings = [...routePolicyWarnings];

  if (budgetConfig.status === 'missing') {
    warnings.push({
      code: 'missing-budget-config',
      message:
        'Bundle budget env vars are unset; report-only budget comparison was skipped.',
    });
  } else if (budgetConfig.status === 'partial') {
    warnings.push({
      code: 'partial-budget-config',
      message: 'One bundle budget env var is unset; report-only comparison is partial.',
    });
  }

  if (metrics.routes.length === 0) {
    warnings.push({
      code: 'no-route-metrics',
      message: 'No Next route metrics were parsed from the build output.',
    });
  }

  return warnings;
}

/**
 * Returns the overall report-only status from warnings and budget findings.
 * @param {ReportWarning[]} warnings - Report warnings.
 * @param {BudgetFinding[]} findings - Budget findings.
 * @returns {'ok' | 'warning'} Overall status.
 */
function getReportStatus(warnings, findings) {
  return warnings.length > 0 || findings.length > 0 ? 'warning' : 'ok';
}

/**
 * Finds the route with the largest first-load JS payload.
 * @param {{ route: string, firstLoadJsBytes: number }[]} routes - Route metrics.
 * @returns {{ route: string, firstLoadJsBytes: number } | null} Largest route, if any.
 */
function findLargestFirstLoadRoute(routes) {
  /** @type {{ route: string, firstLoadJsBytes: number } | null} */
  let largestRoute = null;

  for (const route of routes) {
    if (largestRoute === null || route.firstLoadJsBytes > largestRoute.firstLoadJsBytes) {
      largestRoute = route;
    }
  }

  return largestRoute;
}

/**
 * Renders a short Markdown bundle budget report.
 * @param {BudgetReport} report - Report payload.
 * @returns {string} Markdown report body.
 */
function renderMarkdownReport(report) {
  const lines = [
    '# Next Build Bundle Budget Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    `Routes parsed: ${report.routeCount}`,
    `Shared First Load JS: ${formatBytes(report.sharedFirstLoadJsBytes)}`,
    `Largest route First Load JS: ${
      report.largestFirstLoadRoute
        ? `${report.largestFirstLoadRoute.route} (${formatBytes(report.largestFirstLoadRoute.firstLoadJsBytes)})`
        : 'n/a'
    }`,
    `Budget config: ${report.budgetConfig.status}`,
    `Budget First Load JS: ${formatBytes(report.budgetConfig.maxFirstLoadJsBytes)}`,
    `Budget Route Size: ${formatBytes(report.budgetConfig.maxRouteSizeBytes)}`,
    `Route policy: ${report.routePolicy.status}`,
    '',
    '## Warnings',
    '',
  ];

  if (report.warnings.length === 0) {
    lines.push('No report-only status warnings.');
  } else {
    for (const warning of report.warnings) {
      lines.push(`- ${warning.code}: ${warning.message}`);
    }
  }

  lines.push(
    '',
    '## Route Policy Proposal',
    '',
    [
      'Route-level policies in this report are report-only proposals derived',
      'from tracked baseline summary evidence. They do not fail CI.',
    ].join(' '),
    ''
  );

  if (report.routePolicy.entries.length === 0) {
    lines.push('No route-level report-only proposal entries.');
  } else {
    lines.push(
      `Source: ${report.routePolicy.sourcePath}`,
      '',
      '| Route | Metric | Proposal | Baseline samples | Source |',
      '| --- | --- | ---: | ---: | --- |',
      ...report.routePolicy.entries.map((entry) => {
        const proposal = formatBytes(entry.proposedBudgetBytes);
        return `| \`${entry.route}\` | ${entry.metric} | ${proposal} | ${entry.sampleCount} | ${entry.sourceMetric} |`;
      })
    );
  }

  lines.push(
    '',
    '## Routes',
    '',
    '| Route | Kind | Size | First Load JS |',
    '| --- | --- | ---: | ---: |',
    ...report.routes.map(
      (route) =>
        `| \`${route.route}\` | ${route.kind} | ${formatBytes(route.sizeBytes)} | ${formatBytes(
          route.firstLoadJsBytes
        )} |`
    ),
    '',
    '## Findings',
    ''
  );

  if (report.findings.length === 0) {
    lines.push('No configured budget overage warnings.');
  } else {
    for (const finding of report.findings) {
      lines.push(`- ${finding.message}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Parses CLI arguments for the bundle budget report script.
 * @param {string[]} argv - CLI arguments after the node/script tokens.
 * @returns {{ inputPath: string | null, outDir: string, baselineSummaryPath: string, help: boolean }} Parsed options.
 */
function parseArgs(argv) {
  /** @type {{ inputPath: string | null, outDir: string, baselineSummaryPath: string, help: boolean }} */
  const options = {
    inputPath: null,
    outDir: DEFAULT_OUT_DIR,
    baselineSummaryPath: DEFAULT_BASELINE_SUMMARY_PATH,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help') {
      options.help = true;
    } else if (arg === '--input') {
      options.inputPath = argv[index + 1] ?? null;
      index += 1;
    } else if (arg === '--out-dir') {
      options.outDir = argv[index + 1] ?? DEFAULT_OUT_DIR;
      index += 1;
    } else if (arg === '--baseline-summary') {
      options.baselineSummaryPath = argv[index + 1] ?? DEFAULT_BASELINE_SUMMARY_PATH;
      index += 1;
    }
  }

  return options;
}

/**
 * Reads an existing build log or runs `npm run build`.
 * @param {string | null} inputPath - Optional build output file path.
 * @returns {{ output: string, source: string, status: number }} Build output and status.
 */
function readOrCreateBuildOutput(inputPath) {
  if (inputPath) {
    return {
      output: readFileSync(inputPath, 'utf8'),
      source: inputPath,
      status: 0,
    };
  }

  const result = spawnSync('npm', ['run', 'build'], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });

  return {
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    source: 'npm run build',
    status: result.status ?? 1,
  };
}

/**
 * Writes JSON, Markdown, and raw build-log reports.
 * @param {string} outDir - Output directory.
 * @param {string} rawOutput - Raw build output.
 * @param {BudgetReport & { source: string, budgets: { maxFirstLoadJsBytes: number | null, maxRouteSizeBytes: number | null } }} report - JSON report payload.
 */
function writeReports(outDir, rawOutput, report) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'next-build-output.log'), rawOutput);
  writeFileSync(path.join(outDir, 'next-build-budget.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(path.join(outDir, 'next-build-budget.md'), renderMarkdownReport(report));
}

/**
 * Runs the report-only bundle budget command.
 * @param {string[]} argv - CLI arguments after the node/script tokens.
 * @returns {number} Process exit code.
 */
function main(argv) {
  const options = parseArgs(argv);

  if (options.help) {
    console.log(
      [
        'Usage: node scripts/check-next-build-budget.mjs [--input build.log]',
        '[--out-dir reports/bundle-budget]',
        '[--baseline-summary config/quality-baseline-summary.json]',
      ].join(' ')
    );
    return 0;
  }

  const buildOutput = readOrCreateBuildOutput(options.inputPath);
  const metrics = parseNextBuildRouteMetrics(buildOutput.output);
  const budgetConfig = readBudgets(process.env);
  const routePolicy = readRoutePolicyProposal(options.baselineSummaryPath);
  const routePolicyEvaluation = evaluateRoutePolicy(metrics, routePolicy);
  const largestFirstLoadRoute = findLargestFirstLoadRoute(metrics.routes);
  const findings = [...evaluateBudgets(metrics, budgetConfig), ...routePolicyEvaluation.findings];
  const warnings = createReportWarnings(metrics, budgetConfig, [
    ...routePolicy.warnings,
    ...routePolicyEvaluation.warnings,
  ]);
  const report = {
    generatedAt: new Date().toISOString(),
    source: buildOutput.source,
    status: getReportStatus(warnings, findings),
    routeCount: metrics.routes.length,
    sharedFirstLoadJsBytes: metrics.sharedFirstLoadJsBytes,
    largestFirstLoadRoute,
    budgetConfig,
    routePolicy,
    budgets: {
      maxFirstLoadJsBytes: budgetConfig.maxFirstLoadJsBytes,
      maxRouteSizeBytes: budgetConfig.maxRouteSizeBytes,
    },
    findings,
    warnings,
    routes: metrics.routes,
  };

  writeReports(options.outDir, buildOutput.output, report);

  if (buildOutput.status !== 0) {
    console.error(`next build failed; wrote partial report to ${options.outDir}`);
    return buildOutput.status;
  }

  if (metrics.routes.length === 0) {
    console.warn(`No Next route metrics parsed; wrote raw output to ${options.outDir}`);
  } else {
    console.log(`Parsed ${metrics.routes.length} routes; wrote bundle report to ${options.outDir}`);
  }

  return 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  process.exitCode = main(process.argv.slice(2));
}
