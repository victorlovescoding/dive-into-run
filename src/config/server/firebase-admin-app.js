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

export { adminDb, adminAuth, createAdminServerTimestamp, createAdminTimestampFromDate };
