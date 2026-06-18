/* eslint @vitest/expect-expect: ["error", { "assertFunctionNames": ["expect", "assertFails"] }] */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-report-rules';
const RULES_PATH = 'firestore.rules';

/** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'reports', 'report_1'), {
      reporterUid: 'reporter-1',
      targetType: 'post',
      targetKey: 'posts/post_1',
      status: 'open',
      createdAt: serverTimestamp(),
    });
  });
});

/**
 * Returns an authenticated Firestore test client.
 * @param {string} uid - Authenticated uid.
 * @returns {import('firebase/firestore').Firestore} Firestore client.
 */
function dbFor(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

/**
 * Returns an unauthenticated Firestore test client.
 * @returns {import('firebase/firestore').Firestore} Firestore client.
 */
function anonymousDb() {
  return testEnv.unauthenticatedContext().firestore();
}

/**
 * Builds a report document reference.
 * @param {import('firebase/firestore').Firestore} db - Firestore client.
 * @param {string} [reportId] - Report id.
 * @returns {import('firebase/firestore').DocumentReference} Report ref.
 */
function reportRef(db, reportId = 'report_1') {
  return doc(db, 'reports', reportId);
}

describe('reports Firestore rules', () => {
  it('declares an explicit reports deny-all block', () => {
    const rules = readFileSync(RULES_PATH, 'utf8');

    expect(rules).toContain('match /reports/{reportId}');
    expect(rules).toContain('allow read, write: if false');
  });

  it('denies unauthenticated report get/list/create/update/delete', async () => {
    const db = anonymousDb();

    await assertFails(getDoc(reportRef(db)));
    await assertFails(getDocs(collection(db, 'reports')));
    await assertFails(setDoc(reportRef(db, 'report_2'), { reporterUid: 'anon' }));
    await assertFails(updateDoc(reportRef(db), { status: 'closed' }));
    await assertFails(deleteDoc(reportRef(db)));
  });

  it('denies reporter and non-reporter direct report access', async () => {
    for (const uid of ['reporter-1', 'other-user']) {
      const db = dbFor(uid);

      await assertFails(getDoc(reportRef(db)));
      await assertFails(getDocs(collection(db, 'reports')));
      await assertFails(setDoc(reportRef(db, `report_${uid}`), { reporterUid: uid }));
      await assertFails(updateDoc(reportRef(db), { status: 'closed' }));
      await assertFails(deleteDoc(reportRef(db)));
    }
  });
});
