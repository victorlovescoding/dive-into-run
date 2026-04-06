#!/usr/bin/env node

/**
 * Strava Webhook Subscription management CLI.
 * Usage: node scripts/strava-webhook.js <create|view|delete>
 *
 * Required environment variables (loaded from .env):
 *   STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET,
 *   STRAVA_WEBHOOK_VERIFY_TOKEN (for create),
 *   STRAVA_WEBHOOK_CALLBACK_URL (for create)
 */

import 'dotenv/config';

const API_URL = 'https://www.strava.com/api/v3/push_subscriptions';

const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET } = process.env;

if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
  console.error('Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET in environment.');
  process.exit(1);
}

const command = process.argv[2];

/**
 * Creates a new webhook subscription with Strava.
 * @returns {Promise<void>}
 */
async function create() {
  const { STRAVA_WEBHOOK_VERIFY_TOKEN, STRAVA_WEBHOOK_CALLBACK_URL } = process.env;
  if (!STRAVA_WEBHOOK_VERIFY_TOKEN || !STRAVA_WEBHOOK_CALLBACK_URL) {
    console.error('Missing STRAVA_WEBHOOK_VERIFY_TOKEN or STRAVA_WEBHOOK_CALLBACK_URL.');
    process.exit(1);
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      callback_url: STRAVA_WEBHOOK_CALLBACK_URL,
      verify_token: STRAVA_WEBHOOK_VERIFY_TOKEN,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Failed to create subscription:', data);
    process.exit(1);
  }

  console.log('Subscription created successfully!');
  console.log(`Subscription ID: ${data.id}`);
  console.log(`\nAdd this to your .env: STRAVA_WEBHOOK_SUBSCRIPTION_ID=${data.id}`);
}

/**
 * Lists the current webhook subscription.
 * @returns {Promise<void>}
 */
async function view() {
  const url = `${API_URL}?client_id=${STRAVA_CLIENT_ID}&client_secret=${STRAVA_CLIENT_SECRET}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    console.error('Failed to view subscriptions:', data);
    process.exit(1);
  }

  if (data.length === 0) {
    console.log('No active subscriptions.');
  } else {
    console.log('Active subscriptions:');
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Deletes a webhook subscription by ID.
 * @returns {Promise<void>}
 */
async function remove() {
  const subscriptionId = process.argv[3] || process.env.STRAVA_WEBHOOK_SUBSCRIPTION_ID;
  if (!subscriptionId) {
    console.error('Usage: node scripts/strava-webhook.js delete <subscription_id>');
    console.error('Or set STRAVA_WEBHOOK_SUBSCRIPTION_ID in .env');
    process.exit(1);
  }

  const url = `${API_URL}/${subscriptionId}?client_id=${STRAVA_CLIENT_ID}&client_secret=${STRAVA_CLIENT_SECRET}`;
  const res = await fetch(url, { method: 'DELETE' });

  if (res.status === 204) {
    console.log(`Subscription ${subscriptionId} deleted successfully.`);
  } else {
    const data = await res.json();
    console.error('Failed to delete subscription:', data);
    process.exit(1);
  }
}

switch (command) {
  case 'create':
    await create();
    break;
  case 'view':
    await view();
    break;
  case 'delete':
    await remove();
    break;
  default:
    console.log('Usage: node scripts/strava-webhook.js <create|view|delete>');
    process.exit(1);
}
