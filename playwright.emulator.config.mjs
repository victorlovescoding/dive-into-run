/**
 * @file Playwright config for E2E tests that require Firebase Emulator.
 * @description
 * Used for feature 004-event-edit-delete E2E tests.
 *
 * Prerequisites:
 *   1. firebase emulators:start --only auth,firestore
 *   2. npx playwright test --config playwright.emulator.config.mjs
 */

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './specs/004-event-edit-delete/tests/e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'html',
  globalSetup: './specs/004-event-edit-delete/tests/e2e/global-setup.js',
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
