import { adminAuth } from '@/config/server/firebase-admin-app';

/**
 * Verifies a Firebase ID token via the Admin SDK.
 * @param {string} token - Firebase ID token.
 * @returns {Promise<import('firebase-admin/auth').DecodedIdToken>} Decoded token payload.
 */
export default async function verifyFirebaseIdToken(token) {
  return adminAuth.verifyIdToken(token);
}
