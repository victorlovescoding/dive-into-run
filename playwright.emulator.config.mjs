/**
 * @file Playwright config for E2E tests that require Firebase Emulator.
 * @description
 * Optionally uses `E2E_FEATURE` env var to select one feature's global setup and
 * spec subset. Without `E2E_FEATURE`, lists/runs all E2E specs without a
 * feature-specific global setup.
 *
 * Usage:
 *   E2E_FEATURE=004-event-edit-delete npx playwright test --config playwright.emulator.config.mjs
 *   npx playwright test --config playwright.emulator.config.mjs
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

const setupDir = './tests/e2e/_setup';
const featureSpecMatches = {
  '001-event-filtering': ['event-filtering.spec.js'],
  '004-event-edit-delete': ['event-edit-delete.spec.js'],
  '005-event-comments': ['event-comments.spec.js'],
  '014-notification-system': [
    'comment-notification-flow.spec.js',
    'notification-flow.spec.js',
  ],
  '019-posts-ui-refactor': ['posts-ui.spec.js'],
};

const globalSetupPath = feature ? `${setupDir}/${feature}-global-setup.js` : undefined;
const selectedSpecFiles = feature ? featureSpecMatches[feature] : undefined;

if (feature && !existsSync(globalSetupPath)) {
  throw new Error(
    `E2E_FEATURE="${feature}" but ${globalSetupPath} does not exist.\n` +
      'Value must match a global-setup file under ./tests/e2e/_setup/',
  );
}

if (feature && !selectedSpecFiles) {
  throw new Error(
    `E2E_FEATURE="${feature}" has a global setup but no spec subset mapping.\n` +
      'Add it to featureSpecMatches in playwright.emulator.config.mjs.',
  );
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: selectedSpecFiles
    ? selectedSpecFiles.map((specFile) => `**/${specFile}`)
    : '**/*.spec.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60000,
  reporter: 'html',
  globalSetup: globalSetupPath,
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
