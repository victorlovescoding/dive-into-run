/**
 * @file Shared Firestore Rules emulator helpers for server-rule specs.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const PROJECT_ID = 'demo-test';
const FIRESTORE_RULES_PATH = path.join(process.cwd(), 'firestore.rules');

/**
 * @typedef {import('@firebase/rules-unit-testing').RulesTestEnvironment} RulesTestEnvironment
 * @typedef {import('@firebase/rules-unit-testing').RulesTestContext} RulesTestContext
 * @typedef {ReturnType<RulesTestContext['firestore']>} RulesFirestore
 * @typedef {(db: RulesFirestore) => Promise<void>} SeedFirestoreCallback
 */

/**
 * Creates a rules test environment using the repository Firestore rules.
 * @returns {Promise<RulesTestEnvironment>} Initialized rules test environment.
 */
export async function createRulesTestEnvironment() {
  const rules = await readFile(FIRESTORE_RULES_PATH, 'utf8');

  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules },
  });
}

/**
 * Returns a Firestore client authenticated as the provided user ID.
 * @param {RulesTestEnvironment} testEnv - Rules test environment.
 * @param {string} uid - Firebase Auth user ID to attach to requests.
 * @returns {RulesFirestore} Authenticated Firestore client.
 */
export function authenticatedDb(testEnv, uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

/**
 * Returns a Firestore client without Firebase Auth credentials.
 * @param {RulesTestEnvironment} testEnv - Rules test environment.
 * @returns {RulesFirestore} Unauthenticated Firestore client.
 */
export function unauthenticatedDb(testEnv) {
  return testEnv.unauthenticatedContext().firestore();
}

/**
 * Seeds Firestore documents while security rules are disabled.
 * @param {RulesTestEnvironment} testEnv - Rules test environment.
 * @param {SeedFirestoreCallback} seedFn - Callback that writes seed documents.
 * @returns {Promise<void>} Resolves after seed writes complete.
 */
export async function seedFirestore(testEnv, seedFn) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await seedFn(context.firestore());
  });
}

/**
 * Clears Firestore emulator state for this test project.
 * @param {RulesTestEnvironment} testEnv - Rules test environment.
 * @returns {Promise<void>} Resolves after all documents are removed.
 */
export async function clearFirestore(testEnv) {
  await testEnv.clearFirestore();
}

/**
 * Clears Firestore data and releases rules test resources.
 * @param {RulesTestEnvironment} testEnv - Rules test environment.
 * @returns {Promise<void>} Resolves after cleanup completes.
 */
export async function cleanupRulesTestEnvironment(testEnv) {
  await testEnv.clearFirestore();
  await testEnv.cleanup();
}
