import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  });
}

const adminDb = admin.firestore();
const adminAuth = admin.auth();

/**
 * Creates a Firestore server timestamp sentinel for Admin SDK writes.
 * @returns {import('firebase-admin/firestore').FieldValue} Firestore server timestamp sentinel.
 */
function createAdminServerTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

/**
 * Creates an Admin SDK timestamp from a JavaScript Date.
 * @param {Date} date - JavaScript Date instance.
 * @returns {import('firebase-admin/firestore').Timestamp} Admin SDK timestamp.
 */
function createAdminTimestampFromDate(date) {
  return admin.firestore.Timestamp.fromDate(date);
}

/**
 * Gets the Admin SDK Storage bucket lazily.
 * @returns {{ deleteFiles: (options: { prefix: string, force?: boolean }) => Promise<unknown> }} Default or configured Storage bucket.
 */
function getAdminStorageBucket() {
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  return bucketName ? admin.storage().bucket(bucketName) : admin.storage().bucket();
}

/**
 * Creates a Firestore delete-field sentinel for Admin SDK writes.
 * @returns {import('firebase-admin/firestore').FieldValue} Firestore delete-field sentinel.
 */
function createAdminDeleteFieldValue() {
  return admin.firestore.FieldValue.delete();
}

/**
 * Creates a Firestore increment sentinel for Admin SDK writes.
 * @param {number} delta - Counter delta.
 * @returns {import('firebase-admin/firestore').FieldValue} Firestore increment sentinel.
 */
function createAdminIncrement(delta) {
  return admin.firestore.FieldValue.increment(delta);
}

export {
  adminDb,
  adminAuth,
  getAdminStorageBucket,
  createAdminServerTimestamp,
  createAdminTimestampFromDate,
  createAdminDeleteFieldValue,
  createAdminIncrement,
};
