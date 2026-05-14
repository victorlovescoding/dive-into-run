declare module '@next/bundle-analyzer' {
  import type { NextConfig } from 'next';

  interface BundleAnalyzerOptions {
    enabled?: boolean;
    openAnalyzer?: boolean;
    analyzerMode?: 'json' | 'static';
    logLevel?: 'info' | 'warn' | 'error' | 'silent';
  }

  type BundleAnalyzer = (config?: NextConfig) => NextConfig;

  function bundleAnalyzer(options?: BundleAnalyzerOptions): BundleAnalyzer;

  export = bundleAnalyzer;
}
