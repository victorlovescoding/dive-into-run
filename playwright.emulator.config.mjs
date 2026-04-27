/**
 * @file Playwright config for E2E tests that require Firebase Emulator.
 * @description
 * Requires `E2E_FEATURE` env var to select which feature's global-setup to load.
 * `testDir` is fixed at `./tests/e2e/`. `globalSetup` is resolved from
 * `./tests/e2e/_setup/<feature>-global-setup.js` based on `E2E_FEATURE` env var.
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
      'Value must match a global-setup file under ./tests/e2e/_setup/ (e.g. "004-event-edit-delete" → ./tests/e2e/_setup/004-event-edit-delete-global-setup.js)',
  );
}

const setupDir = './tests/e2e/_setup';
const globalSetupPath = `${setupDir}/${feature}-global-setup.js`;

if (!existsSync(globalSetupPath)) {
  throw new Error(
    `E2E_FEATURE="${feature}" but ${globalSetupPath} does not exist.\n` +
      'Value must match a global-setup file under ./tests/e2e/_setup/',
  );
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
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
  webServer: process.env.CI_E2E_SERVER_STARTED
    ? undefined
    : {
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
