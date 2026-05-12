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

const CORE_CSP_DIRECTIVES = Object.freeze([
  "default-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "connect-src 'self'",
  'https://identitytoolkit.googleapis.com',
  'https://firestore.googleapis.com',
  'https://firebasestorage.googleapis.com',
  'https://www.strava.com',
  'http://localhost:*',
  'ws://localhost:*',
  'https://nominatim.openstreetmap.org',
  "img-src 'self'",
  'https://lh3.googleusercontent.com',
  'https://*.tile.openstreetmap.org',
  'https://www.cwa.gov.tw',
]);

/**
 * Verifies the common security header contract on a page or API response.
 * @param {Record<string, string>} headers - Playwright response headers.
 * @returns {void}
 */
function expectSecurityHeaders(headers) {
  const cspReportOnly = headers['content-security-policy-report-only'];

  expect(headers['content-security-policy']).toBeUndefined();
  expect(cspReportOnly).toBeDefined();
  for (const directive of CORE_CSP_DIRECTIVES) {
    expect(cspReportOnly).toContain(directive);
  }
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
