/**
 * @file Playwright config for E2E tests that require Firebase Emulator.
 * @description
 * Picks up E2E specs from any feature under `specs/*\/tests/e2e/**\/*.spec.js`.
 *
 * Prerequisites:
 *   1. firebase emulators:start --only auth,firestore,storage
 *      (or one-shot: firebase emulators:exec --only auth,firestore,storage "npm run test:e2e:emulator")
 *   2. npx playwright test --config playwright.emulator.config.mjs
 *
 * The webServer block injects admin SDK emulator hosts so Next.js API routes
 * under src/app/api/** that use firebase-admin also talk to the local emulator
 * instead of production Firebase.
 */

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './specs',
  testMatch: '**/tests/e2e/**/*.spec.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'html',
  globalSetup: './specs/004-event-edit-delete/tests/e2e/global-setup.js',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: [
      'NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true',
      'FIREBASE_AUTH_EMULATOR_HOST=localhost:9099',
      'FIRESTORE_EMULATOR_HOST=localhost:8080',
      'FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199',
      'npm run dev',
    ].join(' '),
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
