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
      include: ['src/lib/**'],
      exclude: [
        'src/lib/taiwan-locations.js',
        'src/lib/weather-types.js',
        'src/lib/firebase-client.js',
        'src/lib/firestore-types.js',
        'src/lib/**/*.test.{js,jsx}',
        'src/lib/**/__tests__/**',
      ],
      thresholds: {
        lines: 95,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'browser',
          environment: 'jsdom',
          setupFiles: './vitest.setup.jsx',
          exclude: ['specs/g8-server-coverage/**', '**/e2e/**', '**/node_modules/**'],
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
          include: ['specs/g8-server-coverage/**/*.test.js'],
          fileParallelism: false,
        },
      },
    ],
  },
});
