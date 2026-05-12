import { readFile } from 'node:fs/promises';
import path from 'node:path';

const HYDRATION_MESSAGE_PATTERNS = Object.freeze([
  /hydration failed/i,
  /hydration mismatch/i,
  /server rendered html did(?: not|n't) match/i,
  /text content (?:does not|did not) match/i,
  /expected server html to contain/i,
  /did not expect server html to contain/i,
  /there was an error while hydrating/i,
  /a tree hydrated but some attributes/i,
  /minified react error #(?:418|423|425)/i,
]);

const AXE_INTERACTIVE_BASELINE_FILE = 'axe-interactive-baseline.json';
const AXE_INTERACTIVE_BASELINE_VERSION = 1;
const AXE_INTERACTIVE_BASELINE_NAME = 'axe-interactive-emulator';

/**
 * Loads AxeBuilder lazily so Playwright and direct Node ESM imports resolve the
 * package through the same runtime import path.
 * @returns {Promise<typeof import('@axe-core/playwright').AxeBuilder>} AxeBuilder constructor.
 */
async function loadAxeBuilder() {
  const axePlaywright = await import('@axe-core/playwright');
  return axePlaywright.AxeBuilder;
}

/**
 * Resolves a path next to this helper without depending on the caller's cwd.
 * Playwright compiles this helper through CommonJS even when direct Node
 * imports parse it as ESM, so avoid import.meta here.
 * @param {string} filename - File name to resolve beside this helper.
 * @returns {string} Absolute sibling file path.
 */
function resolveQualityGateHelperSibling(filename) {
  const stack = new Error().stack ?? '';
  const helperPath = stack
    .split('\n')
    .map((line) => line.match(/(?:file:\/\/)?([^\s()]*quality-gate-helpers\.js)/)?.[1])
    .find(Boolean);

  if (!helperPath) {
    throw new Error('Unable to resolve quality gate helper path');
  }

  return path.join(path.dirname(helperPath), filename);
}

/**
 * @typedef {object} AxeViolationEntry
 * @property {string} ruleId - Axe rule identifier.
 * @property {string} impact - Axe impact level.
 * @property {string} target - Stable target selector text.
 * @property {string} signature - Stable ruleId|impact|target signature.
 */

/**
 * @typedef {AxeViolationEntry & {
 *   route: string,
 *   state: string,
 *   reason: string,
 *   owner: string,
 *   expiry: string,
 * }} AxeInteractiveBaselineEntry
 */

/**
 * @typedef {object} AxeInteractiveBaseline
 * @property {number} version - Baseline schema version.
 * @property {string} generatedFor - Gate name this baseline applies to.
 * @property {Record<string, string>} metadata - Baseline review metadata.
 * @property {AxeInteractiveBaselineEntry[]} entries - Known axe violation entries.
 */

/**
 * Checks whether a browser message is a React hydration mismatch/error signal.
 * @param {string} text - Browser console or page error message text.
 * @returns {boolean} Whether the message should fail the hydration smoke gate.
 */
export function isReactHydrationMessage(text) {
  return HYDRATION_MESSAGE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Collects only React hydration-related browser console and page errors.
 * @param {import('@playwright/test').Page} page - Playwright page under test.
 * @returns {{ assertNoErrors: () => void, dispose: () => void }} Collector controls.
 */
export function collectReactHydrationErrors(page) {
  /** @type {{ source: string, text: string }[]} */
  const entries = [];

  const recordIfHydrationMessage = (source, text) => {
    if (isReactHydrationMessage(text)) {
      entries.push({ source, text });
    }
  };

  const onConsole = (message) => {
    const messageType = message.type();
    if (messageType !== 'error' && messageType !== 'warning') {
      return;
    }

    recordIfHydrationMessage(`console.${messageType}`, message.text());
  };

  const onPageError = (error) => {
    recordIfHydrationMessage('pageerror', [error.message, error.stack].filter(Boolean).join('\n'));
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  return {
    assertNoErrors() {
      if (entries.length === 0) {
        return;
      }

      const details = entries
        .map(({ source, text }) => `[${source}] ${text}`)
        .join('\n\n');
      throw new Error(`React hydration warnings/errors detected:\n\n${details}`);
    },
    dispose() {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
    },
  };
}

/**
 * Converts an axe node target into a stable string for report summaries.
 * @param {unknown} target - Axe node target.
 * @returns {string} Stable target text.
 */
function normalizeAxeTarget(target) {
  if (Array.isArray(target)) {
    return target.map((part) => String(part)).join(' ');
  }
  return String(target ?? '');
}

/**
 * Builds stable sorted axe violation entries.
 * @param {{ id?: string, impact?: string | null, nodes?: { target?: unknown }[] }[]} violations - Axe violations.
 * @returns {AxeViolationEntry[]} Stable sorted violation entries.
 */
export function normalizeAxeViolationEntries(violations) {
  return violations
    .flatMap((violation) => {
      const ruleId = violation.id ?? '';
      const impact = violation.impact ?? '';
      return (violation.nodes ?? []).map((node) => {
        const target = normalizeAxeTarget(node.target);
        return {
          ruleId,
          impact,
          target,
          signature: `${ruleId}|${impact}|${target}`,
        };
      });
    })
    .sort((left, right) => left.signature.localeCompare(right.signature));
}

/**
 * Builds stable sorted axe violation signatures as ruleId|impact|target.
 * @param {{ id?: string, impact?: string | null, nodes?: { target?: unknown }[] }[]} violations - Axe violations.
 * @returns {string[]} Stable sorted violation signatures.
 */
export function normalizeAxeViolationSignatures(violations) {
  return normalizeAxeViolationEntries(violations).map((entry) => entry.signature);
}

/**
 * @param {unknown} value - Value to check.
 * @returns {value is Record<string, unknown>} Whether value is a non-array object record.
 */
function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {unknown} value - Value to validate.
 * @param {string} pathLabel - Human-readable baseline path for error messages.
 * @returns {asserts value is string} Asserts value is a non-empty string.
 */
function assertNonEmptyString(value, pathLabel) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid axe interactive baseline: ${pathLabel} must be a non-empty string`);
  }
}

/**
 * @param {unknown} entry - Baseline entry candidate.
 * @param {number} index - Entry index for error messages.
 * @returns {asserts entry is AxeInteractiveBaselineEntry} Asserts entry matches the baseline contract.
 */
function assertBaselineEntry(entry, index) {
  if (!isRecord(entry)) {
    throw new Error(`Invalid axe interactive baseline: entries[${index}] must be an object`);
  }

  const prefix = `entries[${index}]`;
  assertNonEmptyString(entry.route, `${prefix}.route`);
  assertNonEmptyString(entry.state, `${prefix}.state`);
  assertNonEmptyString(entry.ruleId, `${prefix}.ruleId`);
  assertNonEmptyString(entry.impact, `${prefix}.impact`);
  assertNonEmptyString(entry.target, `${prefix}.target`);
  assertNonEmptyString(entry.signature, `${prefix}.signature`);
  assertNonEmptyString(entry.reason, `${prefix}.reason`);
  assertNonEmptyString(entry.owner, `${prefix}.owner`);
  assertNonEmptyString(entry.expiry, `${prefix}.expiry`);

  const expectedSignature = `${entry.ruleId}|${entry.impact}|${entry.target}`;
  if (entry.signature !== expectedSignature) {
    throw new Error(
      `Invalid axe interactive baseline: ${prefix}.signature must equal ${expectedSignature}`,
    );
  }
}

/**
 * Validates the committed axe interactive baseline contract.
 * @param {unknown} baseline - Parsed baseline JSON candidate.
 * @returns {asserts baseline is AxeInteractiveBaseline} Asserts baseline matches the expected contract.
 */
export function validateAxeInteractiveBaseline(baseline) {
  if (!isRecord(baseline)) {
    throw new Error('Invalid axe interactive baseline: root must be an object');
  }

  if (baseline.version !== AXE_INTERACTIVE_BASELINE_VERSION) {
    throw new Error('Invalid axe interactive baseline: version must be 1');
  }

  if (baseline.generatedFor !== AXE_INTERACTIVE_BASELINE_NAME) {
    throw new Error(
      `Invalid axe interactive baseline: generatedFor must be ${AXE_INTERACTIVE_BASELINE_NAME}`,
    );
  }

  if (!isRecord(baseline.metadata)) {
    throw new Error('Invalid axe interactive baseline: metadata must be an object');
  }

  assertNonEmptyString(baseline.metadata.createdOn, 'metadata.createdOn');
  assertNonEmptyString(baseline.metadata.sourceFeature, 'metadata.sourceFeature');
  assertNonEmptyString(baseline.metadata.sourceSpec, 'metadata.sourceSpec');
  assertNonEmptyString(baseline.metadata.reviewedScope, 'metadata.reviewedScope');

  if (!Array.isArray(baseline.entries)) {
    throw new Error('Invalid axe interactive baseline: entries must be an array');
  }

  baseline.entries.forEach(assertBaselineEntry);
}

/**
 * Loads the committed interactive axe baseline JSON.
 * @returns {Promise<AxeInteractiveBaseline>} Validated interactive axe baseline.
 */
export async function loadAxeInteractiveBaseline() {
  const baselinePath = resolveQualityGateHelperSibling(AXE_INTERACTIVE_BASELINE_FILE);
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  validateAxeInteractiveBaseline(baseline);
  return baseline;
}

/**
 * Compares current axe entries against the scoped route/state baseline.
 * @param {{
 *   route: string,
 *   state: string,
 *   current: AxeViolationEntry[],
 *   baseline: AxeInteractiveBaseline,
 * }} options - Route, state, current violations, and loaded baseline.
 * @returns {{
 *   baselineKnown: AxeViolationEntry[],
 *   newSignatures: AxeViolationEntry[],
 *   noLongerObserved: AxeInteractiveBaselineEntry[],
 * }} Baseline comparison grouped by known, new, and resolved signatures.
 */
export function compareAxeViolationsToBaseline({ route, state, current, baseline }) {
  const scopedBaseline = baseline.entries
    .filter((entry) => entry.route === route && entry.state === state)
    .sort((left, right) => left.signature.localeCompare(right.signature));
  const baselineSignatures = new Set(scopedBaseline.map((entry) => entry.signature));
  const currentSignatures = new Set(current.map((entry) => entry.signature));

  return {
    baselineKnown: current.filter((entry) => baselineSignatures.has(entry.signature)),
    newSignatures: current.filter((entry) => !baselineSignatures.has(entry.signature)),
    noLongerObserved: scopedBaseline.filter((entry) => !currentSignatures.has(entry.signature)),
  };
}

/**
 * Runs axe and attaches a report without failing the test on violations.
 * @param {import('@playwright/test').Page} page - Playwright page under test.
 * @param {import('@playwright/test').TestInfo} testInfo - Playwright test metadata.
 * @param {string} routeLabel - Stable route label for attachment names.
 * @returns {Promise<void>}
 */
export async function attachAxeReportOnly(page, testInfo, routeLabel) {
  const AxeBuilder = await loadAxeBuilder();
  const results = await new AxeBuilder({ page }).analyze();
  const violationSignatures = normalizeAxeViolationSignatures(results.violations);

  await testInfo.attach(`axe-${routeLabel}-summary.json`, {
    body: JSON.stringify(
      {
        url: page.url(),
        violationCount: results.violations.length,
        violationSignatures,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });

  await testInfo.attach(`axe-${routeLabel}-raw.json`, {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });

  if (results.violations.length > 0) {
    testInfo.annotations.push({
      type: 'axe-report-only',
      description: `${routeLabel}: ${results.violations.length} violation(s) attached`,
    });
  }
}

/**
 * Runs axe, attaches raw and baseline summary artifacts, and fails only on new signatures.
 * @param {import('@playwright/test').Page} page - Playwright page under test.
 * @param {import('@playwright/test').TestInfo} testInfo - Playwright test metadata.
 * @param {{ route: string, state: string }} scope - Baseline route and state scope.
 * @returns {Promise<void>}
 */
export async function attachAxeInteractiveBaselineReport(page, testInfo, { route, state }) {
  const baseline = await loadAxeInteractiveBaseline();
  const AxeBuilder = await loadAxeBuilder();
  const results = await new AxeBuilder({ page }).analyze();
  const current = normalizeAxeViolationEntries(results.violations);
  const comparison = compareAxeViolationsToBaseline({ route, state, current, baseline });
  const summary = {
    url: page.url(),
    route,
    state,
    violationCount: results.violations.length,
    current,
    baselineKnown: comparison.baselineKnown,
    newSignatures: comparison.newSignatures,
    noLongerObserved: comparison.noLongerObserved,
  };

  await testInfo.attach(`axe-${state}-summary.json`, {
    body: JSON.stringify(summary, null, 2),
    contentType: 'application/json',
  });

  await testInfo.attach(`axe-${state}-raw.json`, {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });

  if (comparison.baselineKnown.length > 0 || comparison.noLongerObserved.length > 0) {
    testInfo.annotations.push({
      type: 'axe-baseline-known',
      description: `${state}: ${comparison.baselineKnown.length} known, ${comparison.noLongerObserved.length} no longer observed`,
    });
  }

  if (comparison.newSignatures.length === 0) {
    return;
  }

  const details = comparison.newSignatures
    .map(
      (entry) =>
        `state=${state} ruleId=${entry.ruleId} impact=${entry.impact} target=${entry.target} signature=${entry.signature}`,
    )
    .join('\n');
  throw new Error(`New axe violation signature(s) detected:\n${details}`);
}
