// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import nextConfig from '../../../next.config.mjs';

/**
 * Converts Next.js header tuples into a lookup table for focused assertions.
 * @param {{ key: string, value: string }[]} headers - Header tuples from Next config.
 * @returns {Map<string, string>} Lower-case header key to configured value.
 */
function toHeaderMap(headers) {
  return new Map(headers.map(({ key, value }) => [key.toLowerCase(), value]));
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
});
