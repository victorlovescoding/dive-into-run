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
import { isActiveRecord } from '@/service/post-service';

/**
 * @typedef {import('@/service/member-dashboard-service').FetchMyEventsResult} FetchMyEventsResult
 * @typedef {import('@/service/member-dashboard-service').FetchMyCommentsResult} FetchMyCommentsResult
 * @typedef {object} FetchMyEventsPrevResult
 * @property {import('@/service/member-dashboard-service').MyEventItem[]} allEvents - Cached full event list.
 * @property {number | null} nextCursor - Offset cursor for the next page.
 * @property {Set<string>} [hostedIds] - Hosted event ids for UI highlighting.
 * @typedef {object} FetchMyCommentsPrevResult
 * @property {import('firebase/firestore').QueryDocumentSnapshot | string | null} lastDoc - Comment page cursor.
 * @property {Map<string, string>} [titleCache] - Shared parent title cache.
 */

/**
 * Returns the cursor for a normalized member post document.
 * @param {import('@/repo/client/firebase-member-repo').MemberFirestoreDocument} document - Normalized repo document.
 * @returns {import('firebase/firestore').QueryDocumentSnapshot | null} Firestore cursor.
 */
function getMemberPostDocumentCursor(document) {
  return document.cursor ?? null;
}

/**
 * Returns the cursor for a normalized member comment document.
 * @param {import('@/repo/client/firebase-member-repo').MemberCommentDocument} document - Normalized repo document.
 * @returns {import('firebase/firestore').QueryDocumentSnapshot | string | null} Comment page cursor.
 */
function getMemberCommentDocumentCursor(document) {
  return document.cursor ?? null;
}

/**
 * Fetches raw dashboard pages until enough active records are available or the raw query ends.
 * @template {import('@/repo/client/firebase-member-repo').MemberFirestoreDocument | import('@/repo/client/firebase-member-repo').MemberCommentDocument} T
 * @param {object} params - Pagination collection params.
 * @param {import('firebase/firestore').QueryDocumentSnapshot | string | null} params.initialAfterDoc - Cursor from previous public page.
 * @param {number} params.pageSize - Public active item page size.
 * @param {(afterDoc: import('firebase/firestore').QueryDocumentSnapshot | string | null) => Promise<{ documents: T[], lastDoc: import('firebase/firestore').QueryDocumentSnapshot | string | null }>} params.fetchPage - Raw page fetcher.
 * @param {(document: T) => boolean} params.isActive - Active record predicate.
 * @param {(document: T) => import('firebase/firestore').QueryDocumentSnapshot | string | null} params.getCursor - Cursor extractor.
 * @returns {Promise<{ documents: T[], lastDoc: import('firebase/firestore').QueryDocumentSnapshot | string | null }>} Active docs and cursor of the last included active doc.
 */
async function fetchActiveDashboardDocuments({
  initialAfterDoc,
  pageSize,
  fetchPage,
  isActive,
  getCursor,
}) {
  /** @type {T[]} */
  const documents = [];
  let lastDoc = null;

  /**
   * Loads the next raw page. Recursion keeps each request sequential without violating no-await-in-loop.
   * @param {import('firebase/firestore').QueryDocumentSnapshot | string | null} afterDoc - Raw page cursor.
   * @returns {Promise<void>}
   */
  async function loadNextPage(afterDoc) {
    const page = await fetchPage(afterDoc);

    for (const document of page.documents) {
      if (!isActive(document)) continue;

      documents.push(document);
      lastDoc = getCursor(document);
      if (documents.length >= pageSize) break;
    }

    if (documents.length >= pageSize || !page.lastDoc) return;
    await loadNextPage(page.lastDoc);
  }

  await loadNextPage(initialAfterDoc);

  return { documents, lastDoc };
}

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
  /** @type {{ documents: import('@/repo/client/firebase-member-repo').MemberFirestoreDocument[], lastDoc: import('firebase/firestore').QueryDocumentSnapshot | string | null }} */
  const postsPage = await fetchActiveDashboardDocuments({
    initialAfterDoc: prevResult?.lastDoc ?? null,
    pageSize,
    fetchPage: (afterDoc) =>
      fetchPostDocumentsPageByAuthorUid(uid, {
        afterDoc: typeof afterDoc === 'string' ? null : afterDoc,
        pageSize,
      }),
    isActive: (document) => isActiveRecord(document.data),
    getCursor: getMemberPostDocumentCursor,
  });

  return buildMyPostsPage(postsPage.documents, postsPage.lastDoc);
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
  /** @type {{ documents: import('@/repo/client/firebase-member-repo').MemberCommentDocument[], lastDoc: import('firebase/firestore').QueryDocumentSnapshot | string | null }} */
  const commentsPage = await fetchActiveDashboardDocuments({
    initialAfterDoc: prevResult?.lastDoc ?? null,
    pageSize,
    fetchPage: (afterDoc) =>
      fetchCommentDocumentsPageByAuthorUid(uid, {
        afterDoc,
        pageSize,
      }),
    isActive: (document) => isActiveRecord(document.data),
    getCursor: getMemberCommentDocumentCursor,
  });

  const commentItems = buildRawMyCommentItems(commentsPage.documents);
  const missingParentRefs = collectMissingCommentParentRefs(commentItems, titleCache);

  if (missingParentRefs.length > 0) {
    const parentTitles = await fetchParentTitlesByRefs(missingParentRefs);
    mergeCommentTitleCache(titleCache, parentTitles);
  }

  return buildMyCommentsPage(commentItems, commentsPage.lastDoc, titleCache);
}
