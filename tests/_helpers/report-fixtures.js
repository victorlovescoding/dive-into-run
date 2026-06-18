import { createHash } from 'node:crypto';

export const REPORT_FIXTURE_UIDS = Object.freeze({
  reporter: 'uid_reporter',
  postAuthor: 'uid_post_author',
  commentAuthor: 'uid_comment_author',
  eventHost: 'uid_event_host',
  eventCommentAuthor: 'uid_event_comment_author',
});

export const REPORT_FIXTURE_IDS = Object.freeze({
  postId: 'post_123',
  commentId: 'comment_456',
  eventId: 'event_123',
});

export const REPORT_REASON_LABEL_FIXTURES = Object.freeze({
  spam: '垃圾訊息',
  harassment: '騷擾或霸凌',
  hate: '仇恨或歧視',
  sexual: '色情內容',
  violence: '暴力或危險行為',
  illegal: '違法內容',
  misinformation: '不實或誤導',
  other: '其他',
});

export const REPORT_SERVER_OWNED_FIELDS = Object.freeze([
  'reportId',
  'targetKey',
  'targetSnapshot',
  'reporterUid',
  'status',
  'createdAt',
]);

export const REPORT_TARGET_CASES = Object.freeze([
  {
    targetType: 'post',
    target: { postId: REPORT_FIXTURE_IDS.postId },
    targetIdentity: { targetType: 'post', postId: REPORT_FIXTURE_IDS.postId },
    targetKey: `posts/${REPORT_FIXTURE_IDS.postId}`,
    targetPath: `/posts/${REPORT_FIXTURE_IDS.postId}`,
  },
  {
    targetType: 'postComment',
    target: {
      postId: REPORT_FIXTURE_IDS.postId,
      commentId: REPORT_FIXTURE_IDS.commentId,
    },
    targetIdentity: {
      targetType: 'postComment',
      postId: REPORT_FIXTURE_IDS.postId,
      commentId: REPORT_FIXTURE_IDS.commentId,
    },
    targetKey: `posts/${REPORT_FIXTURE_IDS.postId}/comments/${REPORT_FIXTURE_IDS.commentId}`,
    targetPath: `/posts/${REPORT_FIXTURE_IDS.postId}?commentId=${REPORT_FIXTURE_IDS.commentId}`,
  },
  {
    targetType: 'event',
    target: { eventId: REPORT_FIXTURE_IDS.eventId },
    targetIdentity: { targetType: 'event', eventId: REPORT_FIXTURE_IDS.eventId },
    targetKey: `events/${REPORT_FIXTURE_IDS.eventId}`,
    targetPath: `/events/${REPORT_FIXTURE_IDS.eventId}`,
  },
  {
    targetType: 'eventComment',
    target: {
      eventId: REPORT_FIXTURE_IDS.eventId,
      commentId: REPORT_FIXTURE_IDS.commentId,
    },
    targetIdentity: {
      targetType: 'eventComment',
      eventId: REPORT_FIXTURE_IDS.eventId,
      commentId: REPORT_FIXTURE_IDS.commentId,
    },
    targetKey: `events/${REPORT_FIXTURE_IDS.eventId}/comments/${REPORT_FIXTURE_IDS.commentId}`,
    targetPath: `/events/${REPORT_FIXTURE_IDS.eventId}?commentId=${REPORT_FIXTURE_IDS.commentId}`,
  },
]);

/**
 * Computes the expected report id contract.
 * @param {object} params - Hash params.
 * @param {string} params.reporterUid - Reporter uid.
 * @param {string} params.targetType - Report target type.
 * @param {string} params.targetKey - Canonical target key.
 * @returns {string} Lowercase sha256 hex id.
 */
export function expectedReportId({ reporterUid, targetType, targetKey }) {
  return createHash('sha256').update(`${reporterUid}:${targetType}:${targetKey}`).digest('hex');
}

/**
 * Creates a valid report API payload.
 * @param {Partial<{
 *   targetType: string,
 *   target: Record<string, unknown>,
 *   reason: string,
 *   details: string,
 *   sourcePath: string,
 * }>} [overrides] - Payload overrides.
 * @returns {Record<string, unknown>} Valid report payload.
 */
export function createReportPayload(overrides = {}) {
  const targetCase = REPORT_TARGET_CASES[0];
  return {
    targetType: targetCase.targetType,
    target: { ...targetCase.target },
    reason: 'spam',
    details: '',
    sourcePath: targetCase.targetPath,
    ...overrides,
  };
}

/**
 * Creates a snapshot-like target document for resolver tests.
 * @param {Record<string, unknown> | null} data - Firestore payload or null.
 * @param {string} [id] - Document id.
 * @param {string} [path] - Document path.
 * @returns {{ id: string, path: string, data: Record<string, unknown> } | null} Target document.
 */
export function createReportTargetDocument(data, id = 'doc_1', path = 'collection/doc_1') {
  if (!data) return null;
  return { id, path, data };
}

export const REPORT_TARGET_DATA = Object.freeze({
  post: {
    authorUid: REPORT_FIXTURE_UIDS.postAuthor,
    authorName: '文章作者',
    authorImgURL: 'https://example.test/post-author.png',
    title: '完整文章標題',
    content: '文章內容'.repeat(260),
    postAt: 'post-created-at',
    mediaUrls: ['https://example.test/media.jpg'],
    reporterUid: 'client-forged-reporter',
  },
  postComment: {
    authorUid: REPORT_FIXTURE_UIDS.commentAuthor,
    authorName: '留言者',
    authorImgURL: 'https://example.test/comment-author.png',
    comment: '留言內容'.repeat(260),
    createdAt: 'comment-created-at',
  },
  event: {
    hostUid: REPORT_FIXTURE_UIDS.eventHost,
    hostName: '主揪',
    hostPhotoURL: 'https://example.test/host.png',
    title: '完整活動標題',
    description: '活動描述'.repeat(260),
    createdAt: 'event-created-at',
    routeImage: 'https://example.test/route.png',
  },
  eventComment: {
    authorUid: REPORT_FIXTURE_UIDS.eventCommentAuthor,
    authorName: '活動留言者',
    authorImgURL: 'https://example.test/event-comment-author.png',
    content: '活動留言內容'.repeat(260),
    createdAt: 'event-comment-created-at',
  },
});
