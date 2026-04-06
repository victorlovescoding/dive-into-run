import { NextResponse } from 'next/server';
import { adminDb, verifyAuthToken } from '@/lib/firebase-admin';

const BATCH_LIMIT = 500;

/**
 * Handles Strava disconnect requests. Deletes stored tokens, marks connection
 * as disconnected, and removes all synced activities for the user.
 * @param {Request} request - Incoming POST request with Bearer token.
 * @returns {Promise<NextResponse>} JSON response with success status or error.
 */
export async function POST(request) {
  const uid = await verifyAuthToken(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const connectionRef = adminDb.collection('stravaConnections').doc(uid);
  const connectionDoc = await connectionRef.get();

  if (!connectionDoc.exists || !connectionDoc.data()?.connected) {
    return NextResponse.json({ error: 'Not connected to Strava' }, { status: 400 });
  }

  // Delete stravaTokens doc
  await adminDb.collection('stravaTokens').doc(uid).delete();

  // Update stravaConnections to disconnected (keep doc for state tracking)
  await connectionRef.update({ connected: false });

  // Delete all stravaActivities for this user in batches of 500
  const activitiesRef = adminDb.collection('stravaActivities');
  const activitiesQuery = activitiesRef.where('uid', '==', uid).limit(BATCH_LIMIT);
  let snapshot = await activitiesQuery.get();

  while (!snapshot.empty) {
    const batch = adminDb.batch();
    snapshot.docs.forEach((activityDoc) => {
      batch.delete(activityDoc.ref);
    });
    // eslint-disable-next-line no-await-in-loop -- batch deletes must run sequentially to avoid exceeding Firestore limits
    await batch.commit();
    // eslint-disable-next-line no-await-in-loop -- must re-query after each batch commit
    snapshot = await activitiesQuery.get();
  }

  return NextResponse.json({ success: true });
}
