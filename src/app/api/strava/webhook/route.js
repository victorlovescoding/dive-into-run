import { NextResponse } from 'next/server';
import {
  buildStravaWebhookChallengeResponse,
  hasMatchingStravaWebhookSubscription,
  processWebhookEvent,
} from '@/runtime/server/use-cases/strava-server-use-cases';

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
 * Handles Strava webhook subscription validation.
 * @param {Request} request - Incoming GET request from Strava.
 * @returns {NextResponse} JSON response echoing hub.challenge or 403.
 */
export function GET(request) {
  const result = buildStravaWebhookChallengeResponse(request);
  return NextResponse.json(result.body, { status: result.status });
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

  if (!hasMatchingStravaWebhookSubscription(event.subscription_id)) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 403 });
  }

  // Fire-and-forget: respond 200 immediately, process event asynchronously.
  // Strava requires a 200 response within 2 seconds.
  processWebhookEvent(event).catch(() => {});

  return new Response('OK', { status: 200 });
}
