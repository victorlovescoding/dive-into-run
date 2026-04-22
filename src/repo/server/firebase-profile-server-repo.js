import { adminDb } from '@/config/server/firebase-admin-app';

/**
 * Reads the raw public profile document for a user.
 *
 * This repo layer intentionally returns the Firestore document payload as-is so
 * the shared mapper owns the public profile shape.
 * @param {string} uid - Target Firebase user uid.
 * @returns {Promise<Record<string, unknown> | null>} Raw Firestore document data or null.
 */
export default async function getUserProfileDocument(uid) {
  const snap = await adminDb.collection('users').doc(uid).get();
  if (!snap.exists) {
    return null;
  }

  return /** @type {Record<string, unknown>} */ (snap.data() ?? {});
}
