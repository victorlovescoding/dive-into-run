import { expect, test } from '@playwright/test';

const SECURITY_HEADER_CASES = Object.freeze([
  { label: 'events-page', path: '/events' },
  { label: 'strava-webhook-api', path: '/api/strava/webhook?hub.mode=subscribe' },
]);

const EXPECTED_CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com https://firebasestorage.googleapis.com https://*.tile.openstreetmap.org https://www.cwa.gov.tw",
  "font-src 'self' data:",
  "connect-src 'self' http://localhost:* ws://localhost:* https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebaseinstallations.googleapis.com https://firebase.googleapis.com https://firebasestorage.googleapis.com https://www.strava.com https://nominatim.openstreetmap.org",
].join('; ');

/**
 * Verifies the common security header contract on a page or API response.
 * @param {Record<string, string>} headers - Playwright response headers.
 * @returns {void}
 */
function expectSecurityHeaders(headers) {
  const cspReportOnly = headers['content-security-policy-report-only'];

  expect(headers['content-security-policy']).toBeUndefined();
  expect(cspReportOnly).toBe(EXPECTED_CSP_REPORT_ONLY);
  expect(cspReportOnly).not.toContain('report-uri');
  expect(cspReportOnly).not.toContain('report-to');

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
