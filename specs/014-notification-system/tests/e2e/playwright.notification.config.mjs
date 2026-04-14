/**
 * @file Playwright config for Notification System E2E tests (Firebase Emulator).
 * @description
 * Used for feature 014-notification-system E2E tests (T036, T037).
 *
 * Prerequisites:
 *   1. firebase emulators:start --only auth,firestore
 *   2. npx playwright test --config specs/014-notification-system/tests/e2e/playwright.notification.config.mjs
 */

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60000,
  reporter: 'html',
  globalSetup: './global-setup.js',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
