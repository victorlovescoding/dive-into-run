import { REPORT_EXCERPT_MAX_LENGTH } from '@/constants/report-constants';

class TargetUnavailableError extends Error {
  constructor(message = 'Report target is unavailable') {
    super(message);
    this.name = 'TargetUnavailableError';
    this.code = 'target_unavailable';
  }
}

class SelfReportForbiddenError extends Error {
  constructor(message = 'Self report is forbidden') {
    super(message);
    this.name = 'SelfReportForbiddenError';
    this.code = 'self_report_forbidden';
  }
}

/**
 * @typedef {{ id: string, path: string, data: Record<string, unknown> }} ReportTargetDocument
 * @typedef {{ target: ReportTargetDocument | null, parent?: ReportTargetDocument | null }} ReportTargetDocuments
 */

/**
 * Checks active visibility used by server report resolution.
 * @param {Record<string, unknown> | null | undefined} data - Firestore data.
 * @returns {boolean} Whether the target is active.
 */
function isActiveTargetData(data) {
  return (
    Boolean(data) &&
    !Object.prototype.hasOwnProperty.call(data, 'deletedAt') &&
    !data.accountDeletionHidden
  );
}

/**
 * Returns active document data or throws target unavailable.
 * @param {ReportTargetDocument | null | undefined} document - Target document.
 * @returns {Record<string, unknown>} Active target data.
 */
function requireActiveData(document) {
  if (!document || !isActiveTargetData(document.data)) {
    throw new TargetUnavailableError();
  }

  return document.data;
}

/**
 * Converts an unknown field to a display string.
 * @param {unknown} value - Candidate text.
 * @returns {string} Text or empty string.
 */
function stringValue(value) {
  return typeof value === 'string' ? value : '';
}

/**
 * Returns a fallback-safe display name.
 * @param {unknown} value - Candidate display name.
 * @returns {string} Display name.
 */
function displayName(value) {
  return stringValue(value) || '匿名使用者';
}

/**
 * Builds a 500-character excerpt from target text.
 * @param {unknown} value - Candidate target text.
 * @returns {string} Trimmed excerpt.
 */
function excerpt(value) {
  return stringValue(value).trim().slice(0, REPORT_EXCERPT_MAX_LENGTH);
}

/**
 * Rejects self-report attempts.
 * @param {string} reporterUid - Reporter uid.
 * @param {unknown} authorUid - Target author uid.
 */
function assertNotSelfReport(reporterUid, authorUid) {
  if (typeof authorUid === 'string' && authorUid === reporterUid) {
    throw new SelfReportForbiddenError();
  }
}

/**
 * Resolves the server-owned snapshot for a report target.
 * @param {object} params - Resolver params.
 * @param {import('@/types/report-types').TargetIdentity} params.targetIdentity - Normalized identity.
 * @param {string} params.reporterUid - Authenticated reporter uid.
 * @param {ReportTargetDocuments} params.targetDocuments - Documents read by server repo.
 * @returns {import('@/types/report-types').ReportTargetSnapshot} Minimal snapshot.
 */
export function resolveReportTarget({ targetIdentity, reporterUid, targetDocuments }) {
  if (targetIdentity.targetType === 'post') {
    const post = requireActiveData(targetDocuments.target);
    assertNotSelfReport(reporterUid, post.authorUid);
    return {
      authorUid: stringValue(post.authorUid),
      authorDisplayName: displayName(post.authorName),
      title: stringValue(post.title),
      excerpt: excerpt(post.content),
      targetPath: `/posts/${targetIdentity.postId}`,
      createdAt: post.postAt ?? post.createdAt ?? null,
    };
  }

  if (targetIdentity.targetType === 'postComment') {
    const parentPost = requireActiveData(targetDocuments.parent);
    const comment = requireActiveData(targetDocuments.target);
    assertNotSelfReport(reporterUid, comment.authorUid);
    return {
      authorUid: stringValue(comment.authorUid),
      authorDisplayName: displayName(comment.authorName),
      title: stringValue(parentPost.title),
      excerpt: excerpt(comment.comment),
      targetPath: `/posts/${targetIdentity.postId}?commentId=${targetIdentity.commentId}`,
      createdAt: comment.createdAt ?? null,
    };
  }

  if (targetIdentity.targetType === 'event') {
    const event = requireActiveData(targetDocuments.target);
    const authorUid = event.hostUid ?? event.authorUid;
    assertNotSelfReport(reporterUid, authorUid);
    return {
      authorUid: stringValue(authorUid),
      authorDisplayName: displayName(event.hostName ?? event.authorName),
      title: stringValue(event.title),
      excerpt: excerpt(event.description),
      targetPath: `/events/${targetIdentity.eventId}`,
      createdAt: event.createdAt ?? null,
    };
  }

  if (targetIdentity.targetType === 'eventComment') {
    const parentEvent = requireActiveData(targetDocuments.parent);
    const comment = requireActiveData(targetDocuments.target);
    assertNotSelfReport(reporterUid, comment.authorUid);
    return {
      authorUid: stringValue(comment.authorUid),
      authorDisplayName: displayName(comment.authorName),
      title: stringValue(parentEvent.title),
      excerpt: excerpt(comment.content),
      targetPath: `/events/${targetIdentity.eventId}?commentId=${targetIdentity.commentId}`,
      createdAt: comment.createdAt ?? null,
    };
  }

  throw new TargetUnavailableError();
}

export { SelfReportForbiddenError, TargetUnavailableError };
