/**
 * @file Playwright config for E2E tests that require Firebase Emulator.
 * @description
 * Requires `E2E_FEATURE` env var to specify which feature's E2E tests to run.
 * Resolves `testDir` and `globalSetup` dynamically from `specs/<feature>/tests/e2e/`.
 *
 * Usage:
 *   E2E_FEATURE=004-event-edit-delete npx playwright test --config playwright.emulator.config.mjs
 *
 * One-shot with emulator:
 *   firebase emulators:exec --only auth,firestore,storage \
 *     "E2E_FEATURE=004-event-edit-delete npm run test:e2e:emulator"
 *
 * The webServer block injects admin SDK emulator hosts so Next.js API routes
 * under src/app/api/** that use firebase-admin also talk to the local emulator
 * instead of production Firebase.
 */

import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const feature = process.env.E2E_FEATURE;

if (!feature) {
  throw new Error(
    'E2E_FEATURE env var is required.\n' +
      'Usage: E2E_FEATURE=004-event-edit-delete npx playwright test --config playwright.emulator.config.mjs\n' +
      'Value must match a directory name under specs/ (e.g. "004-event-edit-delete")',
  );
}

const featureE2eDir = `./specs/${feature}/tests/e2e`;
if (!existsSync(featureE2eDir)) {
  throw new Error(
    `E2E_FEATURE="${feature}" but ${featureE2eDir} does not exist.\n` +
      'Value must match a directory name under specs/ that contains tests/e2e/',
  );
}

const globalSetupPath = `${featureE2eDir}/global-setup.js`;

export default defineConfig({
  testDir: featureE2eDir,
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60000,
  reporter: 'html',
  globalSetup: existsSync(globalSetupPath) ? globalSetupPath : undefined,
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
