import { expect, test } from '@playwright/test';

const SECURITY_HEADER_CASES = Object.freeze([
  {
    label: 'events-page',
    path: '/events',
  },
  {
    label: 'strava-webhook-api',
    path: '/api/strava/webhook?hub.mode=subscribe',
  },
]);

/**
 * Verifies the common security header contract on a page or API response.
 * @param {Record<string, string>} headers - Playwright response headers.
 * @returns {void}
 */
function expectSecurityHeaders(headers) {
  expect(headers['content-security-policy-report-only']).toContain("frame-ancestors 'none'");
  expect(headers['strict-transport-security']).toBe('max-age=0');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['x-frame-options']).toBe('DENY');
}

test.describe('security headers smoke', () => {
  for (const { label, path } of SECURITY_HEADER_CASES) {
    test(`${label} includes baseline security headers`, async ({ request }) => {
      const response = await request.get(path);

      expect(response.status()).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(500);
      expectSecurityHeaders(response.headers());

      await response.dispose();
    });
  }
});
