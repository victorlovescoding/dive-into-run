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
 * Runs axe and attaches a report without failing the test on violations.
 * @param {import('@playwright/test').Page} page - Playwright page under test.
 * @param {import('@playwright/test').TestInfo} testInfo - Playwright test metadata.
 * @param {string} routeLabel - Stable route label for attachment names.
 * @returns {Promise<void>}
 */
export async function attachAxeReportOnly(page, testInfo, routeLabel) {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.map(({ id, impact, description, nodes }) => ({
    id,
    impact,
    description,
    nodes: nodes.slice(0, 3).map(({ target, failureSummary }) => ({
      target,
      failureSummary,
    })),
    nodeCount: nodes.length,
  }));

  await testInfo.attach(`axe-${routeLabel}.json`, {
    body: JSON.stringify(
      {
        url: page.url(),
        violationCount: violations.length,
        violations,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });

  if (violations.length > 0) {
    testInfo.annotations.push({
      type: 'axe-report-only',
      description: `${routeLabel}: ${violations.length} violation(s) attached`,
    });
  }
}
