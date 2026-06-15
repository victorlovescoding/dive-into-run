export const POST_SEARCH_KEYWORD = 'reef';
export const POST_SEARCH_CHINESE_KEYWORD = '海岸';
export const POST_SEARCH_VIEWER_UID = 'viewer-post-search';
export const POST_SEARCH_AUTHOR_UID = 'author-post-search';

const BASE_POST_AT = '2026-06-14T08:00:00.000Z';
const SAME_TIME_POST_AT = '2026-06-14T09:30:00.000Z';

/**
 * @typedef {object} PostSearchPostFixture
 * @property {string} id - Post id.
 * @property {string} authorUid - Author uid.
 * @property {string} authorName - Author display name.
 * @property {string} authorImgURL - Author avatar URL.
 * @property {string} title - Post title.
 * @property {string} content - Post content.
 * @property {unknown} postAt - Timestamp-like post time.
 * @property {number} likesCount - Likes count.
 * @property {number} commentsCount - Comments count.
 * @property {unknown} [deletedAt] - Soft-delete timestamp-like value.
 * @property {boolean} [accountDeletionHidden] - Account-deletion visibility flag.
 */

/**
 * Builds a lightweight Firestore Timestamp-compatible value for unit tests.
 * @param {string | Date} value - ISO string or date source.
 * @returns {{
 *   seconds: number,
 *   nanoseconds: number,
 *   toDate: () => Date,
 *   toMillis: () => number,
 *   isEqual: (other: { toMillis?: () => number } | null | undefined) => boolean,
 * }} Timestamp-like test value.
 */
export function createPostSearchTimestamp(value = BASE_POST_AT) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('createPostSearchTimestamp: value must be a valid date');
  }

  const millis = date.getTime();

  return {
    seconds: Math.floor(millis / 1000),
    nanoseconds: (millis % 1000) * 1_000_000,
    toDate: () => new Date(millis),
    toMillis: () => millis,
    isEqual: (other) => other?.toMillis?.() === millis,
  };
}

/**
 * Creates a public active post record with search-focused defaults.
 * @param {Record<string, unknown>} [overrides] - Fields to override.
 * @returns {PostSearchPostFixture & Record<string, unknown>} Post fixture.
 */
export function createPostSearchPost(overrides = {}) {
  return {
    id: 'post-search-title-newest',
    authorUid: POST_SEARCH_AUTHOR_UID,
    authorName: '搜尋測試跑者',
    authorImgURL: 'https://example.test/avatar/post-search-author.png',
    title: `Morning ${POST_SEARCH_KEYWORD} route`,
    content: 'Easy aerobic miles before breakfast.',
    postAt: createPostSearchTimestamp(),
    likesCount: 3,
    commentsCount: 2,
    ...overrides,
  };
}

/**
 * Creates highlight range metadata without coupling tests to rendered HTML.
 * @param {object} params - Range fields.
 * @param {'title' | 'snippet'} params.field - Highlight target.
 * @param {number} params.start - Inclusive start offset.
 * @param {number} params.end - Exclusive end offset.
 * @returns {{ field: 'title' | 'snippet', start: number, end: number }} Highlight range.
 */
export function createPostSearchHighlightRange({ field, start, end }) {
  return { field, start, end };
}

/**
 * Creates a post search match fixture.
 * @param {object} [params] - Match fields.
 * @param {ReturnType<typeof createPostSearchPost>} [params.post] - Matched post.
 * @param {'title' | 'content'} [params.hitType] - Primary hit type.
 * @param {{ title: boolean, content: boolean }} [params.matchedFields] - Matched fields.
 * @param {number} [params.firstMatchIndex] - First hit index within the primary hit field.
 * @param {string} [params.snippet] - Search result snippet.
 * @param {Array<ReturnType<typeof createPostSearchHighlightRange>>} [params.highlightRanges] - Highlight metadata.
 * @param {{ hitTypeRank: number, postAt: unknown, id: string }} [params.rankKey] - Stable sort key.
 * @returns {{
 *   post: ReturnType<typeof createPostSearchPost>,
 *   hitType: 'title' | 'content',
 *   matchedFields: { title: boolean, content: boolean },
 *   firstMatchIndex: number,
 *   snippet: string,
 *   highlightRanges: Array<ReturnType<typeof createPostSearchHighlightRange>>,
 *   rankKey: { hitTypeRank: number, postAt: unknown, id: string },
 * }} Search match fixture.
 */
export function createPostSearchMatch({
  post = createPostSearchPost(),
  hitType = 'title',
  matchedFields = { title: hitType === 'title', content: hitType === 'content' },
  firstMatchIndex = hitType === 'title' ? post.title.toLowerCase().indexOf(POST_SEARCH_KEYWORD) : 0,
  snippet = post.content,
  highlightRanges = [
    createPostSearchHighlightRange({
      field: hitType === 'title' ? 'title' : 'snippet',
      start: Math.max(0, firstMatchIndex),
      end: Math.max(0, firstMatchIndex) + POST_SEARCH_KEYWORD.length,
    }),
  ],
  rankKey = {
    hitTypeRank: hitType === 'title' ? 0 : 1,
    postAt: post.postAt,
    id: post.id,
  },
} = {}) {
  return {
    post,
    hitType,
    matchedFields,
    firstMatchIndex,
    snippet,
    highlightRanges,
    rankKey,
  };
}

/**
 * Creates the load-more cursor contract used by post search use-case tests.
 * @param {Record<string, unknown>} [overrides] - Cursor fields to override.
 * @returns {{
 *   lastPostAt: unknown,
 *   lastPostId: string,
 *   scannedCount: number,
 *   resultCount: number,
 *   exhausted: boolean,
 * } & Record<string, unknown>} Search page cursor fixture.
 */
export function createPostSearchCursor(overrides = {}) {
  return {
    lastPostAt: createPostSearchTimestamp('2026-06-14T07:00:00.000Z'),
    lastPostId: 'post-search-content-older',
    scannedCount: 6,
    resultCount: 4,
    exhausted: false,
    ...overrides,
  };
}

/**
 * Creates a search use-case response fixture.
 * @param {object} [params] - Response fields.
 * @param {string} [params.keyword] - Search keyword.
 * @param {Array<ReturnType<typeof createPostSearchMatch>>} [params.items] - Match list.
 * @param {ReturnType<typeof createPostSearchCursor> | null} [params.nextCursor] - Next page cursor.
 * @param {boolean} [params.hasMore] - Whether more candidate pages exist.
 * @param {number} [params.scannedCount] - Candidate scan count.
 * @returns {{
 *   keyword: string,
 *   items: Array<ReturnType<typeof createPostSearchMatch>>,
 *   nextCursor: ReturnType<typeof createPostSearchCursor> | null,
 *   hasMore: boolean,
 *   scannedCount: number,
 * }} Search response fixture.
 */
export function createPostSearchPage({
  keyword = POST_SEARCH_KEYWORD,
  items = [],
  nextCursor = createPostSearchCursor(),
  hasMore = true,
  scannedCount = 0,
} = {}) {
  return { keyword, items, nextCursor, hasMore, scannedCount };
}

/**
 * Creates deterministic posts that cover title/content ranking, tie-breakers,
 * visibility exclusions, non-searchable fields, and interaction hydration.
 * @returns {{
 *   keyword: string,
 *   chineseKeyword: string,
 *   viewerUid: string,
 *   authorUid: string,
 *   posts: {
 *     titleHitNewest: ReturnType<typeof createPostSearchPost>,
 *     titleAndContentHit: ReturnType<typeof createPostSearchPost>,
 *     titleHitSameTimeHighId: ReturnType<typeof createPostSearchPost>,
 *     titleHitSameTimeLowId: ReturnType<typeof createPostSearchPost>,
 *     contentHit: ReturnType<typeof createPostSearchPost>,
 *     contentHitOlder: ReturnType<typeof createPostSearchPost>,
 *     chineseContentHit: ReturnType<typeof createPostSearchPost>,
 *     softDeleted: ReturnType<typeof createPostSearchPost>,
 *     accountHidden: ReturnType<typeof createPostSearchPost>,
 *     authorNameOnly: ReturnType<typeof createPostSearchPost>,
 *   },
 *   expected: {
 *     titleTierOrder: string[],
 *     contentTierOrder: string[],
 *     fullResultOrder: string[],
 *     excludedIds: string[],
 *   },
 * }} Complete fixture set.
 */
export function createPostSearchFixtureSet() {
  const titleHitNewest = createPostSearchPost({
    id: 'post-search-title-newest',
    title: 'REEF tempo route notes',
    content: 'A steady run with no keyword in the body.',
    postAt: createPostSearchTimestamp('2026-06-14T12:00:00.000Z'),
    likesCount: 9,
    commentsCount: 4,
  });
  const titleAndContentHit = createPostSearchPost({
    id: 'post-search-title-and-content',
    title: 'Night reef recovery',
    content: 'The reef segment felt quiet after sunset.',
    postAt: createPostSearchTimestamp('2026-06-14T11:00:00.000Z'),
    likesCount: 4,
    commentsCount: 1,
  });
  const titleHitSameTimeHighId = createPostSearchPost({
    id: 'post-search-title-same-time-b',
    title: 'Reef strides beta',
    content: 'Same timestamp high id title hit.',
    postAt: createPostSearchTimestamp(SAME_TIME_POST_AT),
  });
  const titleHitSameTimeLowId = createPostSearchPost({
    id: 'post-search-title-same-time-a',
    title: 'Reef strides alpha',
    content: 'Same timestamp low id title hit.',
    postAt: createPostSearchTimestamp(SAME_TIME_POST_AT),
  });
  const contentHit = createPostSearchPost({
    id: 'post-search-content-newer',
    title: 'Harbor progression',
    content: 'Warmup through the pier before the reef climb and cooldown.',
    postAt: createPostSearchTimestamp('2026-06-14T10:30:00.000Z'),
    commentsCount: 8,
  });
  const contentHitOlder = createPostSearchPost({
    id: 'post-search-content-older',
    title: 'Easy coastline miles',
    content: 'I saved energy until the final reef path near the lighthouse.',
    postAt: createPostSearchTimestamp('2026-06-14T07:00:00.000Z'),
  });
  const chineseContentHit = createPostSearchPost({
    id: 'post-search-content-chinese',
    title: '週末長跑紀錄',
    content: `最後一段沿著${POST_SEARCH_CHINESE_KEYWORD}慢跑收操。`,
    postAt: createPostSearchTimestamp('2026-06-14T06:30:00.000Z'),
  });
  const softDeleted = createPostSearchPost({
    id: 'post-search-soft-deleted',
    title: 'Deleted reef route',
    content: 'This soft-deleted post must never appear.',
    deletedAt: createPostSearchTimestamp('2026-06-14T12:30:00.000Z'),
  });
  const accountHidden = createPostSearchPost({
    id: 'post-search-account-hidden',
    title: 'Hidden reef route',
    content: 'This account-deletion-hidden post must never appear.',
    accountDeletionHidden: true,
  });
  const authorNameOnly = createPostSearchPost({
    id: 'post-search-author-name-only',
    authorName: 'Reef Runner',
    title: 'Hill repeat journal',
    content: 'No searchable keyword in title or content.',
  });

  return {
    keyword: POST_SEARCH_KEYWORD,
    chineseKeyword: POST_SEARCH_CHINESE_KEYWORD,
    viewerUid: POST_SEARCH_VIEWER_UID,
    authorUid: POST_SEARCH_AUTHOR_UID,
    posts: {
      titleHitNewest,
      titleAndContentHit,
      titleHitSameTimeHighId,
      titleHitSameTimeLowId,
      contentHit,
      contentHitOlder,
      chineseContentHit,
      softDeleted,
      accountHidden,
      authorNameOnly,
    },
    expected: {
      titleTierOrder: [
        titleHitNewest.id,
        titleAndContentHit.id,
        titleHitSameTimeHighId.id,
        titleHitSameTimeLowId.id,
      ],
      contentTierOrder: [contentHit.id, contentHitOlder.id],
      fullResultOrder: [
        titleHitNewest.id,
        titleAndContentHit.id,
        titleHitSameTimeHighId.id,
        titleHitSameTimeLowId.id,
        contentHit.id,
        contentHitOlder.id,
      ],
      excludedIds: [softDeleted.id, accountHidden.id, authorNameOnly.id],
    },
  };
}
