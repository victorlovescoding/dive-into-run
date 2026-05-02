import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/{service,repo,runtime,lib,config,ui,components,app}/**'],
      exclude: [
        'src/lib/taiwan-locations.js',
        'src/lib/weather-types.js',
        'src/lib/firebase-client.js',
        'src/lib/firestore-types.js',
        'src/**/*.test.{js,jsx}',
        'src/**/__tests__/**',
        '**/*.d.ts',
      ],
      thresholds: {
        // S9: per-directory coverage gate. ui/components/app use Wave 3 baseline +5
        // and should keep ramping by +5 per review until the practical 60-70 floor.
        // Do not force src/app/** to 70+; app entries are thin and E2E-heavy.
        'src/service/**': { lines: 80 },
        'src/repo/**': { lines: 75 },
        'src/runtime/**': { lines: 60 },
        'src/lib/**': { lines: 80 },
        'src/config/**': { lines: 70 },
        'src/ui/**': { lines: 94.43 },
        'src/components/**': { lines: 91.64 },
        'src/app/**': { lines: 95.07 },
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'browser',
          environment: 'jsdom',
          setupFiles: './vitest.setup.jsx',
          exclude: ['tests/server/**', '**/e2e/**', '**/node_modules/**'],
          alias: {
            '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
          },
          css: {
            modules: {
              classNameStrategy: 'non-scoped',
            },
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          setupFiles: './vitest.setup.server.js',
          include: ['tests/server/**/*.test.js'],
          fileParallelism: false,
        },
      },
    ],
  },
});
