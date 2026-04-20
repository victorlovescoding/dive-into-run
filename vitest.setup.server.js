/**
 * @file Vitest setup for the `server` project (node environment).
 *
 * Requires Firebase Emulator (auth + firestore) running. Wrap server tests
 * with `firebase emulators:exec "vitest run --project=server"` so the emulator
 * injects FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST automatically.
 *
 * Do NOT import vitest.setup.jsx here — its React/Leaflet/firebase-client
 * mocks are jsdom-specific and will pollute the node env.
 */

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error(
    'Server tests require Firebase Emulator. ' +
      'Run via `npm run test:server` or `npm run test:coverage` ' +
      '(wraps `firebase emulators:exec --only auth,firestore`).',
  );
}

process.env.GCLOUD_PROJECT = 'demo-test';
process.env.FIREBASE_ADMIN_PROJECT_ID = 'demo-test';
