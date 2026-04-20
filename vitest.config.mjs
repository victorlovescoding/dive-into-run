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
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.jsx',
    exclude: ['**/e2e/**', '**/node_modules/**'],
    testTimeout: 15000,
    alias: {
      '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    },
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/lib/**'],
      exclude: [
        // 純資料／常數 — 無邏輯可測
        'src/lib/taiwan-locations.js',
        'src/lib/weather-types.js',
        // TODO(G8-followup): 下列 server-only 檔跑在 Node env（firebase-admin SDK），
        // jsdom 環境無法載入；需要另起 node-env test project 才能納入覆蓋率。
        'src/lib/firebase-admin.js',
        'src/lib/firebase-profile-server.js',
        // 防禦性 — 測試檔本身不進分母
        'src/lib/**/*.test.{js,jsx}',
        'src/lib/**/__tests__/**',
      ],
      thresholds: {
        lines: 76,
      },
    },
  },
});
