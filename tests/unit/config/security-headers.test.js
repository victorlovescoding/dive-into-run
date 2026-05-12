// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import nextConfig from '../../../next.config.mjs';

const REQUIRED_CSP_SOURCES = Object.freeze({
  'connect-src': [
    "'self'",
    'http://localhost:*',
    'ws://localhost:*',
    'https://*.googleapis.com',
    'https://*.firebaseio.com',
    'https://*.firebaseapp.com',
    'https://identitytoolkit.googleapis.com',
    'https://securetoken.googleapis.com',
    'https://firestore.googleapis.com',
    'https://firebaseinstallations.googleapis.com',
    'https://firebase.googleapis.com',
    'https://firebasestorage.googleapis.com',
    'https://www.strava.com',
    'https://nominatim.openstreetmap.org',
  ],
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https://lh3.googleusercontent.com',
    'https://firebasestorage.googleapis.com',
    'https://*.tile.openstreetmap.org',
    'https://www.cwa.gov.tw',
  ],
});

/**
 * Converts Next.js header tuples into a lookup table for focused assertions.
 * @param {{ key: string, value: string }[]} headers - Header tuples from Next config.
 * @returns {Map<string, string>} Lower-case header key to configured value.
 */
function toHeaderMap(headers) {
  return new Map(headers.map(({ key, value }) => [key.toLowerCase(), value]));
}

/**
 * Parses a CSP header into directive sources.
 * @param {string} cspHeader - Content-Security-Policy header value.
 * @returns {Map<string, string[]>} Directive name to source expressions.
 */
function parseCspDirectives(cspHeader) {
  return new Map(
    cspHeader
      .split(';')
      .map((directive) => directive.trim())
      .filter(Boolean)
      .map((directive) => {
        const [name, ...sources] = directive.split(/\s+/);
        return [name, sources];
      }),
  );
}

describe('security headers config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('applies report-only security headers to every route', async () => {
    vi.stubEnv('NODE_ENV', 'test');

    const headerRules = await nextConfig.headers();
    const globalRule = headerRules.find((rule) => rule.source === '/:path*');

    expect(globalRule).toBeDefined();

    const headers = toHeaderMap(globalRule.headers);

    expect(headers.has('content-security-policy')).toBe(false);
    expect(headers.get('content-security-policy-report-only')).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers.get('strict-transport-security')).toBe('max-age=0');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('permissions-policy')).toContain('camera=()');
    expect(headers.get('x-frame-options')).toBe('DENY');
  });

  it('uses long-lived HSTS only for production builds', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const headerRules = await nextConfig.headers();
    const globalRule = headerRules.find((rule) => rule.source === '/:path*');
    const headers = toHeaderMap(globalRule.headers);

    expect(headers.get('strict-transport-security')).toBe(
      'max-age=63072000; includeSubDomains; preload',
    );
  });

  it('keeps CSP report-only sources aligned with the runtime allowlist inventory', async () => {
    vi.stubEnv('NODE_ENV', 'test');

    const headerRules = await nextConfig.headers();
    const globalRule = headerRules.find((rule) => rule.source === '/:path*');
    const headers = toHeaderMap(globalRule.headers);
    const directives = parseCspDirectives(headers.get('content-security-policy-report-only'));

    for (const [directive, expectedSources] of Object.entries(REQUIRED_CSP_SOURCES)) {
      expect(directives.get(directive)).toEqual(expect.arrayContaining(expectedSources));
    }
  });
});
