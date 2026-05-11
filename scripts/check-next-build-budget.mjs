import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_OUT_DIR = 'reports/bundle-budget';
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
 */

/**
 * @typedef {object} BudgetReport
 * @property {string} generatedAt - ISO timestamp for the report.
 * @property {number} routeCount - Number of parsed routes.
 * @property {number | null} sharedFirstLoadJsBytes - Shared First Load JS size in bytes.
 * @property {{ route: string, firstLoadJsBytes: number } | null} largestFirstLoadRoute - Largest route by First Load JS.
 * @property {RouteMetric[]} routes - Route-level bundle metrics.
 * @property {BudgetFinding[]} findings - Report-only budget findings.
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
 * @returns {{ maxFirstLoadJsBytes: number | null, maxRouteSizeBytes: number | null }} Budget thresholds.
 */
function readBudgets(env) {
  return {
    maxFirstLoadJsBytes: parseOptionalKilobytes(env.BUNDLE_BUDGET_FIRST_LOAD_KB),
    maxRouteSizeBytes: parseOptionalKilobytes(env.BUNDLE_BUDGET_ROUTE_SIZE_KB),
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
    if (budgets.maxFirstLoadJsBytes !== null && route.firstLoadJsBytes > budgets.maxFirstLoadJsBytes) {
      findings.push({
        level: 'warning',
        route: route.route,
        metric: 'firstLoadJs',
        actualBytes: route.firstLoadJsBytes,
        budgetBytes: budgets.maxFirstLoadJsBytes,
      });
    }

    if (budgets.maxRouteSizeBytes !== null && route.sizeBytes > budgets.maxRouteSizeBytes) {
      findings.push({
        level: 'warning',
        route: route.route,
        metric: 'size',
        actualBytes: route.sizeBytes,
        budgetBytes: budgets.maxRouteSizeBytes,
      });
    }
  }

  return findings;
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
    `Routes parsed: ${report.routeCount}`,
    `Shared First Load JS: ${formatBytes(report.sharedFirstLoadJsBytes)}`,
    `Largest route First Load JS: ${
      report.largestFirstLoadRoute
        ? `${report.largestFirstLoadRoute.route} (${formatBytes(report.largestFirstLoadRoute.firstLoadJsBytes)})`
        : 'n/a'
    }`,
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
    '',
  ];

  if (report.findings.length === 0) {
    lines.push('No report-only budget warnings.');
  } else {
    for (const finding of report.findings) {
      lines.push(
        `- ${finding.route} ${finding.metric}: ${formatBytes(finding.actualBytes)} over ${formatBytes(
          finding.budgetBytes
        )}`
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Parses CLI arguments for the bundle budget report script.
 * @param {string[]} argv - CLI arguments after the node/script tokens.
 * @returns {{ inputPath: string | null, outDir: string, help: boolean }} Parsed options.
 */
function parseArgs(argv) {
  /** @type {{ inputPath: string | null, outDir: string, help: boolean }} */
  const options = {
    inputPath: null,
    outDir: DEFAULT_OUT_DIR,
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
      'Usage: node scripts/check-next-build-budget.mjs [--input build.log] [--out-dir reports/bundle-budget]'
    );
    return 0;
  }

  const buildOutput = readOrCreateBuildOutput(options.inputPath);
  const metrics = parseNextBuildRouteMetrics(buildOutput.output);
  const budgets = readBudgets(process.env);
  const largestFirstLoadRoute = findLargestFirstLoadRoute(metrics.routes);
  const report = {
    generatedAt: new Date().toISOString(),
    source: buildOutput.source,
    routeCount: metrics.routes.length,
    sharedFirstLoadJsBytes: metrics.sharedFirstLoadJsBytes,
    largestFirstLoadRoute,
    budgets,
    findings: evaluateBudgets(metrics, budgets),
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
