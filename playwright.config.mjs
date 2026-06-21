import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT || '3000';
const HOST = process.env.HOSTNAME || '127.0.0.1';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      HOSTNAME: HOST,
      PORT,
      NEXT_PUBLIC_USE_FIREBASE_EMULATOR: 'true',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
