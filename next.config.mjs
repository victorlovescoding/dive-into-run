import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
});

const DEVELOPMENT_HSTS = 'max-age=0';
const PRODUCTION_HSTS = 'max-age=63072000; includeSubDomains; preload';

const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com https://firebasestorage.googleapis.com",
  "font-src 'self' data:",
  [
    "connect-src 'self'",
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
    'https://www.strava.com',
  ].join(' '),
].join('; ');

/**
 * Builds security response headers shared by pages and route handlers.
 * @returns {{ key: string, value: string }[]} Next.js header tuples.
 */
function buildSecurityHeaders() {
  const hstsValue = process.env.NODE_ENV === 'production' ? PRODUCTION_HSTS : DEVELOPMENT_HSTS;

  return [
    {
      key: 'Content-Security-Policy-Report-Only',
      value: cspReportOnly,
    },
    {
      key: 'Strict-Transport-Security',
      value: hstsValue,
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), payment=(), usb=(), geolocation=(self)',
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
  ];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/v0/b/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders(),
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
