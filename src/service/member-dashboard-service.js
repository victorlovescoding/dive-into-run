/**
 * @typedef {import('firebase/firestore').QueryDocumentSnapshot} QueryDocumentSnapshot
 * @typedef {import('@/lib/firebase-posts').Post} Post
 * @typedef {import('@/repo/client/firebase-member-repo').MemberFirestoreDocument} MemberFirestoreDocument
 * @typedef {import('@/repo/client/firebase-member-repo').MemberCommentDocument} MemberCommentDocument
 * @typedef {import('@/repo/client/firebase-member-repo').ParentTitleLookup} ParentTitleLookup
 * @typedef {import('@/repo/client/firebase-member-repo').ParentTitleRecord} ParentTitleRecord
 */

/**
 * @typedef {object} MyEventItem
 * @property {string} id - 活動 ID。
 * @property {string} title - 活動標題。
 * @property {import('firebase/firestore').Timestamp} time - 活動舉辦時間。
 * @property {string} location - 活動地點。
 * @property {string} city - 縣市。
 * @property {number} participantsCount - 目前報名人數。
 * @property {number} maxParticipants - 人數上限。
 * @property {string} hostUid - 主辦者 UID。
 */

/**
 * @typedef {object} MyCommentItem
 * @property {string} id - 留言 ID。
 * @property {'post' | 'event'} source - 來源類型。
 * @property {string} parentId - 所屬文章或活動 ID。
 * @property {string} parentTitle - 所屬文章或活動標題。
 * @property {string} text - 留言內容（正規化）。
 * @property {import('firebase/firestore').Timestamp} createdAt - 留言時間。
 */

/**
 * @typedef {object} FetchMyEventIdsResult
 * @property {string[]} participantIds - User joined event ids.
 * @property {string[]} hostedIds - User hosted event ids.
 */

/**
 * @typedef {object} FetchMyEventsResult
 * @property {MyEventItem[]} items - Current page of events.
 * @property {number | null} nextCursor - Offset cursor for subsequent pages.
 * @property {Set<string>} hostedIds - Hosted event id set for UI highlighting.
 * @property {MyEventItem[]} allEvents - Cached full event list for later slicing.
 */

/**
 * @typedef {object} FetchMyEventsCache
 * @property {MyEventItem[]} allEvents - Cached full event list for later slicing.
 * @property {number | null} nextCursor - Offset cursor for subsequent pages.
 * @property {Set<string>} [hostedIds] - Hosted event id set for UI highlighting.
 */

/**
 * @typedef {object} FetchMyPostsResult
 * @property {Post[]} items - Current page of posts.
 * @property {QueryDocumentSnapshot | null} lastDoc - Firestore cursor for subsequent pages.
 */

/**
 * @typedef {object} FetchMyCommentsResult
 * @property {MyCommentItem[]} items - Current page of comments.
 * @property {QueryDocumentSnapshot | null} lastDoc - Firestore cursor for subsequent pages.
 * @property {Map<string, string>} titleCache - Cached parent titles.
 */

/**
 * Creates the public result for member event ids.
 * @param {string[]} participantIds - User joined event ids.
 * @param {string[]} hostedIds - User hosted event ids.
 * @returns {FetchMyEventIdsResult} Normalized event-id buckets.
 */
export function buildMyEventIdsResult(participantIds, hostedIds) {
  return { participantIds, hostedIds };
}

/**
 * Uses the cached event list from a previous result to serve the next page.
 * @param {FetchMyEventsCache} prevResult - Previous runtime result cache.
 * @param {number} pageSize - Number of items per page.
 * @returns {FetchMyEventsResult} Next page sliced from cache.
 */
export function sliceMyEventsFromCache(prevResult, pageSize) {
  if (prevResult.nextCursor === null) {
    return {
      items: [],
      nextCursor: null,
      hostedIds: prevResult.hostedIds ?? new Set(),
      allEvents: prevResult.allEvents,
    };
  }

  const start = prevResult.nextCursor;
  const items = prevResult.allEvents.slice(start, start + pageSize);
  const nextEnd = start + pageSize;

  return {
    items,
    nextCursor: nextEnd < prevResult.allEvents.length ? nextEnd : null,
    hostedIds: prevResult.hostedIds ?? new Set(),
    allEvents: prevResult.allEvents,
  };
}

/**
 * Builds the first page of member events from repo-level event documents.
 * @param {MemberFirestoreDocument[]} eventDocuments - Raw event documents from repo.
 * @param {string[]} hostedIdsList - Hosted event ids used to build a Set for UI.
 * @param {number} pageSize - Number of items per page.
 * @returns {FetchMyEventsResult} Sorted first page plus cache payload.
 */
export function buildMyEventsPage(eventDocuments, hostedIdsList, pageSize) {
  const allEvents = eventDocuments.map((document) => {
    const { data } = document;

    return /** @type {MyEventItem} */ ({
      id: document.id,
      ...data,
      participantsCount: data.participantsCount ?? 0,
    });
  });

  allEvents.sort((eventA, eventB) => eventB.time.seconds - eventA.time.seconds);

  return {
    items: allEvents.slice(0, pageSize),
    nextCursor: pageSize < allEvents.length ? pageSize : null,
    hostedIds: new Set(hostedIdsList),
    allEvents,
  };
}

/**
 * Maps repo-level post documents to the public dashboard post result.
 * @param {MemberFirestoreDocument[]} postDocuments - Raw post documents from repo.
 * @param {QueryDocumentSnapshot | null} lastDoc - Firestore cursor from repo.
 * @returns {FetchMyPostsResult} Normalized post page.
 */
export function buildMyPostsPage(postDocuments, lastDoc) {
  return {
    items: postDocuments.map(
      (document) =>
        /** @type {Post} */ ({
          id: document.id,
          ...document.data,
        }),
    ),
    lastDoc,
  };
}

/**
 * Normalizes raw comment documents into the dashboard-facing shape before titles are attached.
 * @param {MemberCommentDocument[]} commentDocuments - Repo-level comment documents.
 * @returns {MyCommentItem[]} Comment items with normalized text and empty titles.
 */
export function buildRawMyCommentItems(commentDocuments) {
  return commentDocuments.map((document) => {
    const text = document.source === 'post' ? document.data.comment : document.data.content;

    return /** @type {MyCommentItem} */ ({
      id: document.id,
      source: document.source,
      parentId: document.parentId,
      text: /** @type {string} */ (text ?? ''),
      createdAt: /** @type {import('firebase/firestore').Timestamp} */ (document.data.createdAt),
      parentTitle: '',
    });
  });
}

/**
 * Collects parent ids that are still missing from the comment title cache.
 * Cache behavior intentionally stays keyed by `parentId` only to preserve existing behavior.
 * @param {MyCommentItem[]} commentItems - Comment items for the current page.
 * @param {Map<string, string>} titleCache - Existing title cache.
 * @returns {ParentTitleLookup[]} Parent refs that still need fetching.
 */
export function collectMissingCommentParentRefs(commentItems, titleCache) {
  /** @type {Map<string, ParentTitleLookup>} */
  const missingRefs = new Map();

  commentItems.forEach((item) => {
    if (!titleCache.has(item.parentId) && !missingRefs.has(item.parentId)) {
      missingRefs.set(item.parentId, {
        parentId: item.parentId,
        source: item.source,
      });
    }
  });

  return [...missingRefs.values()];
}

/**
 * Applies fetched parent titles into the shared title cache.
 * @param {Map<string, string>} titleCache - Existing title cache.
 * @param {ParentTitleRecord[]} parentTitleRecords - Newly fetched parent titles.
 * @returns {Map<string, string>} Same cache instance with new values merged in.
 */
export function mergeCommentTitleCache(titleCache, parentTitleRecords) {
  parentTitleRecords.forEach(({ parentId, title }) => {
    titleCache.set(parentId, title ?? '(已刪除)');
  });

  return titleCache;
}

/**
 * Finalizes the public dashboard comments page by attaching parent titles from cache.
 * @param {MyCommentItem[]} commentItems - Comment items for the current page.
 * @param {QueryDocumentSnapshot | null} lastDoc - Firestore cursor from repo.
 * @param {Map<string, string>} titleCache - Shared parent title cache.
 * @returns {FetchMyCommentsResult} Finalized comments page.
 */
export function buildMyCommentsPage(commentItems, lastDoc, titleCache) {
  return {
    items: commentItems.map((item) => ({
      ...item,
      parentTitle: titleCache.get(item.parentId) ?? '(已刪除)',
    })),
    lastDoc,
    titleCache,
  };
}
