/**
 * @file Server-env unit tests for src/lib/firebase-profile-server.js.
 *
 * Runs under the `server` vitest project (node env) wrapped by
 * `firebase emulators:exec --only auth,firestore`. Imports real
 * `firebase-profile-server.js` (and transitively real firebase-admin.js)
 * so v8 coverage records actual execution rather than being stuck at 0%
 * like the mock-based counterpart at
 * specs/012-public-profile/tests/unit/firebase-profile-server.test.js.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

const originalFetch = globalThis.fetch;
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = process.env.GCLOUD_PROJECT || 'demo-test';

/**
 * Clear all Firestore documents via emulator REST API.
 * @returns {Promise<void>} Resolves when the emulator DELETE completes.
 */
async function clearFirestore() {
  const url = `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`;
  const res = await originalFetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to clear Firestore: ${res.status}`);
}

beforeAll(async () => {
  await clearFirestore();
});

beforeEach(async () => {
  await clearFirestore();
});

describe('getUserProfileServer', () => {
  it('returns a PublicProfile without email when the user doc exists', async () => {
    const { adminDb } = await import('@/lib/firebase-admin');
    await adminDb
      .collection('users')
      .doc('u1')
      .set({
        uid: 'u1',
        name: 'Alice',
        email: 'alice@example.com',
        photoURL: 'https://example.com/alice.jpg',
        bio: '熱愛跑步的工程師',
        createdAt: new Date('2024-01-01T00:00:00Z'),
      });

    const { getUserProfileServer } = await import('@/lib/firebase-profile-server');
    const result = await getUserProfileServer('u1');

    expect(result).not.toBeNull();
    expect(result?.uid).toBe('u1');
    expect(result?.name).toBe('Alice');
    expect(result?.photoURL).toBe('https://example.com/alice.jpg');
    expect(result?.bio).toBe('熱愛跑步的工程師');
    expect(result).not.toHaveProperty('email');
  });

  it('omits bio from the result when the source doc has no bio field', async () => {
    const { adminDb } = await import('@/lib/firebase-admin');
    await adminDb
      .collection('users')
      .doc('u2')
      .set({
        uid: 'u2',
        name: 'Bob',
        email: 'bob@example.com',
        photoURL: '',
        createdAt: new Date('2024-02-01T00:00:00Z'),
      });

    const { getUserProfileServer } = await import('@/lib/firebase-profile-server');
    const result = await getUserProfileServer('u2');

    expect(result).not.toBeNull();
    expect(result?.uid).toBe('u2');
    expect(result?.bio).toBeUndefined();
    expect(result).not.toHaveProperty('email');
  });

  it('returns null when the user doc does not exist', async () => {
    const { getUserProfileServer } = await import('@/lib/firebase-profile-server');
    const result = await getUserProfileServer('missing-user');
    expect(result).toBeNull();
  });

  it('throws when uid is an empty string', async () => {
    const { getUserProfileServer } = await import('@/lib/firebase-profile-server');
    await expect(getUserProfileServer('')).rejects.toThrow('uid is required');
  });
});
