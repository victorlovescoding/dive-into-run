import { NextResponse } from 'next/server';
import {
  followRunner,
  unfollowRunner,
  verifyAuthToken,
} from '@/runtime/server/use-cases/follow-server-use-cases';

/**
 * Resolves the dynamic target uid from a Next.js route context.
 * @param {{ params: Promise<{ targetUid: string }> }} context - Route context.
 * @returns {Promise<string>} Target uid.
 */
async function getTargetUid(context) {
  const params = await context.params;
  return params.targetUid;
}

/**
 * Handles follow requests. Requires a Firebase ID token bearer auth header.
 * @param {Request} request - Incoming POST request.
 * @param {{ params: Promise<{ targetUid: string }> }} context - Route context.
 * @returns {Promise<NextResponse>} JSON follow response.
 */
export async function POST(request, context) {
  const viewerUid = await verifyAuthToken(request);
  if (!viewerUid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const targetUid = await getTargetUid(context);
  const result = await followRunner({ viewerUid, targetUid });
  return NextResponse.json(result.body, { status: result.status });
}

/**
 * Handles unfollow requests. Requires a Firebase ID token bearer auth header.
 * @param {Request} request - Incoming DELETE request.
 * @param {{ params: Promise<{ targetUid: string }> }} context - Route context.
 * @returns {Promise<NextResponse>} JSON unfollow response.
 */
export async function DELETE(request, context) {
  const viewerUid = await verifyAuthToken(request);
  if (!viewerUid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const targetUid = await getTargetUid(context);
  const result = await unfollowRunner({ viewerUid, targetUid });
  return NextResponse.json(result.body, { status: result.status });
}
