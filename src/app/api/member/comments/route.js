import { NextResponse } from 'next/server';
import {
  memberCommentsRunner,
  verifyMemberCommentsAuthToken,
} from '@/runtime/server/use-cases/member-comments-server-use-cases';

/**
 * Handles member dashboard comment page requests through the server boundary.
 * Requires a Firebase ID token bearer auth header and only returns the token owner's comments.
 * @param {Request} request - Incoming GET request.
 * @returns {Promise<NextResponse>} JSON comments response.
 */
export async function GET(request) {
  const uid = await verifyMemberCommentsAuthToken(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await memberCommentsRunner({ uid, url: new URL(request.url) });
  return NextResponse.json(result.body, { status: result.status });
}
