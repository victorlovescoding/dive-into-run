import { NextResponse } from 'next/server';
import {
  adminDb,
  getUidByAthleteId,
  ensureValidStravaToken,
  syncSingleStravaActivity,
} from '@/lib/firebase-admin';

/**
 * Handles Strava webhook subscription validation.
 * Strava sends a GET request with hub.mode, hub.challenge, and hub.verify_token
 * to verify the callback URL is active.
 * @param {Request} request - Incoming GET request from Strava.
 * @returns {NextResponse} JSON response echoing hub.challenge or 403.
 */
export function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const challenge = searchParams.get('hub.challenge');
  const verifyToken = searchParams.get('hub.verify_token');

  if (mode === 'subscribe' && verifyToken === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ 'hub.challenge': challenge });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * @typedef {object} StravaWebhookEvent
 * @property {string} object_type - "activity" or "athlete".
 * @property {number} object_id - Strava activity or athlete ID.
 * @property {string} aspect_type - "create", "update", or "delete".
 * @property {Record<string, string>} updates - Changed fields.
 * @property {number} owner_id - Strava athlete ID of the event owner.
 * @property {number} subscription_id - Webhook subscription ID.
 * @property {number} event_time - Unix timestamp of the event.
 */

/**
 * Handles an activity create or update event by fetching the activity
 * from Strava and writing it to Firestore.
 * @param {number} ownerId - Strava athlete ID.
 * @param {number} activityId - Strava activity ID.
 * @returns {Promise<void>}
 */
async function handleActivityCreateOrUpdate(ownerId, activityId) {
  const uid = await getUidByAthleteId(ownerId);
  if (!uid) return;

  const result = await ensureValidStravaToken(uid);
  if (result.error) return;

  await syncSingleStravaActivity({
    uid,
    accessToken: result.accessToken,
    stravaActivityId: activityId,
  });
}

/**
 * Handles an activity delete event by removing it from Firestore.
 * @param {number} activityId - Strava activity ID to delete.
 * @returns {Promise<void>}
 */
async function handleActivityDelete(activityId) {
  await adminDb.collection('stravaActivities').doc(String(activityId)).delete();
}

/**
 * Handles athlete deauthorization by marking the connection as disconnected
 * and deleting stored tokens. Historical activities are preserved.
 * @param {number} ownerId - Strava athlete ID.
 * @returns {Promise<void>}
 */
async function handleAthleteDeauth(ownerId) {
  const uid = await getUidByAthleteId(ownerId);
  if (!uid) return;

  const batch = adminDb.batch();
  batch.delete(adminDb.collection('stravaTokens').doc(uid));
  batch.update(adminDb.collection('stravaConnections').doc(uid), { connected: false });
  await batch.commit();
}

/**
 * Processes a Strava webhook event asynchronously. Dispatches to the
 * appropriate handler based on object_type and aspect_type.
 * @param {StravaWebhookEvent} event - Parsed webhook event payload.
 * @returns {Promise<void>}
 */
async function processWebhookEvent(event) {
  const {
    object_type: objectType,
    object_id: objectId,
    aspect_type: aspectType,
    owner_id: ownerId,
    updates,
  } = event;

  if (objectType === 'athlete' && aspectType === 'update' && updates?.authorized === 'false') {
    await handleAthleteDeauth(ownerId);
    return;
  }

  if (objectType !== 'activity') return;

  if (aspectType === 'create' || aspectType === 'update') {
    await handleActivityCreateOrUpdate(ownerId, objectId);
  } else if (aspectType === 'delete') {
    await handleActivityDelete(objectId);
  }
}

/**
 * Handles incoming Strava webhook event POST requests.
 * Validates subscription_id, responds 200 immediately, then processes
 * the event asynchronously (fire-and-forget).
 * @param {Request} request - Incoming POST request from Strava.
 * @returns {Promise<Response>} 200 OK or 403 Forbidden.
 */
export async function POST(request) {
  const event = /** @type {StravaWebhookEvent} */ (await request.json());

  if (String(event.subscription_id) !== process.env.STRAVA_WEBHOOK_SUBSCRIPTION_ID) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 403 });
  }

  // Fire-and-forget: respond 200 immediately, process event asynchronously.
  // Strava requires a 200 response within 2 seconds.
  processWebhookEvent(event).catch(() => {});

  return new Response('OK', { status: 200 });
}
