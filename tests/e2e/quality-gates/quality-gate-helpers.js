import { AxeBuilder } from '@axe-core/playwright';

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
 * Builds stable sorted axe violation signatures as ruleId|impact|target.
 * @param {{ id?: string, impact?: string | null, nodes?: { target?: unknown }[] }[]} violations - Axe violations.
 * @returns {string[]} Stable sorted violation signatures.
 */
export function normalizeAxeViolationSignatures(violations) {
  return violations
    .flatMap((violation) => {
      const ruleId = violation.id ?? '';
      const impact = violation.impact ?? '';
      return (violation.nodes ?? []).map(
        (node) => `${ruleId}|${impact}|${normalizeAxeTarget(node.target)}`,
      );
    })
    .sort((left, right) => left.localeCompare(right));
}

/**
 * Runs axe and attaches a report without failing the test on violations.
 * @param {import('@playwright/test').Page} page - Playwright page under test.
 * @param {import('@playwright/test').TestInfo} testInfo - Playwright test metadata.
 * @param {string} routeLabel - Stable route label for attachment names.
 * @returns {Promise<void>}
 */
export async function attachAxeReportOnly(page, testInfo, routeLabel) {
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
