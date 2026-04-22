import {
  fetchParticipantEventIdsByUid,
  fetchHostedEventIdsByUid,
  fetchEventDocumentsByIds,
  fetchPostDocumentsPageByAuthorUid,
  fetchCommentDocumentsPageByAuthorUid,
  fetchParentTitlesByRefs,
} from '@/repo/client/firebase-member-repo';
import {
  buildMyEventIdsResult,
  sliceMyEventsFromCache,
  buildMyEventsPage,
  buildMyPostsPage,
  buildRawMyCommentItems,
  collectMissingCommentParentRefs,
  mergeCommentTitleCache,
  buildMyCommentsPage,
} from '@/service/member-dashboard-service';

/**
 * @typedef {import('@/service/member-dashboard-service').FetchMyEventsResult} FetchMyEventsResult
 * @typedef {import('@/service/member-dashboard-service').FetchMyCommentsResult} FetchMyCommentsResult
 * @typedef {object} FetchMyEventsPrevResult
 * @property {import('@/service/member-dashboard-service').MyEventItem[]} allEvents - Cached full event list.
 * @property {number | null} nextCursor - Offset cursor for the next page.
 * @property {Set<string>} [hostedIds] - Hosted event ids for UI highlighting.
 * @typedef {object} FetchMyCommentsPrevResult
 * @property {import('firebase/firestore').QueryDocumentSnapshot | null} lastDoc - Firestore cursor.
 * @property {Map<string, string>} [titleCache] - Shared parent title cache.
 */

/**
 * Returns the event ids where a user is a participant and/or host.
 * @param {string} uid - Target user uid.
 * @returns {Promise<import('@/service/member-dashboard-service').FetchMyEventIdsResult>} Event id buckets.
 */
export async function fetchMyEventIds(uid) {
  const [participantIds, hostedIds] = await Promise.all([
    fetchParticipantEventIdsByUid(uid),
    fetchHostedEventIdsByUid(uid),
  ]);

  return buildMyEventIdsResult(participantIds, hostedIds);
}

/**
 * Returns one page of member events for the dashboard.
 * The first call materializes and sorts the full event set; subsequent calls slice the cached result.
 * @param {string} uid - Target user uid.
 * @param {object} [options] - Paging options.
 * @param {FetchMyEventsPrevResult | null} [options.prevResult] - Previous runtime result.
 * @param {number} [options.pageSize] - Number of items per page.
 * @returns {Promise<FetchMyEventsResult>} Current page plus cache payload.
 */
export async function fetchMyEvents(uid, options = {}) {
  const { prevResult = null, pageSize = 5 } = options;

  if (prevResult?.allEvents) {
    return sliceMyEventsFromCache(prevResult, pageSize);
  }

  const { participantIds, hostedIds } = await fetchMyEventIds(uid);
  const allIds = [...new Set([...participantIds, ...hostedIds])];
  const eventDocuments = await fetchEventDocumentsByIds(allIds);

  return buildMyEventsPage(eventDocuments, hostedIds, pageSize);
}

/**
 * Returns one page of posts authored by the target user.
 * @param {string} uid - Target user uid.
 * @param {object} [options] - Paging options.
 * @param {{ lastDoc: import('firebase/firestore').QueryDocumentSnapshot | null } | null} [options.prevResult] - Previous runtime result.
 * @param {number} [options.pageSize] - Number of items per page.
 * @returns {Promise<import('@/service/member-dashboard-service').FetchMyPostsResult>} Current page of posts.
 */
export async function fetchMyPosts(uid, options = {}) {
  const { prevResult = null, pageSize = 5 } = options;
  const { documents, lastDoc } = await fetchPostDocumentsPageByAuthorUid(uid, {
    afterDoc: prevResult?.lastDoc ?? null,
    pageSize,
  });

  return buildMyPostsPage(documents, lastDoc);
}

/**
 * Returns one page of comments authored by the target user.
 * @param {string} uid - Target user uid.
 * @param {object} [options] - Paging options.
 * @param {FetchMyCommentsPrevResult | null} [options.prevResult] - Previous runtime result.
 * @param {number} [options.pageSize] - Number of items per page.
 * @returns {Promise<FetchMyCommentsResult>} Current page of comments plus title cache.
 */
export async function fetchMyComments(uid, options = {}) {
  const { prevResult = null, pageSize = 5 } = options;
  const titleCache = prevResult?.titleCache ?? new Map();
  const { documents, lastDoc } = await fetchCommentDocumentsPageByAuthorUid(uid, {
    afterDoc: prevResult?.lastDoc ?? null,
    pageSize,
  });

  const commentItems = buildRawMyCommentItems(documents);
  const missingParentRefs = collectMissingCommentParentRefs(commentItems, titleCache);

  if (missingParentRefs.length > 0) {
    const parentTitles = await fetchParentTitlesByRefs(missingParentRefs);
    mergeCommentTitleCache(titleCache, parentTitles);
  }

  return buildMyCommentsPage(commentItems, lastDoc, titleCache);
}
