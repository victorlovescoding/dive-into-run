/**
 * @typedef {'post' | 'postComment' | 'event' | 'eventComment'} ReportTargetType
 */

/**
 * @typedef {'spam' | 'harassment' | 'hate' | 'sexual' | 'violence' | 'illegal' | 'misinformation' | 'other'} ReportReason
 */

/**
 * @typedef {'open'} ReportStatus
 */

/**
 * @typedef {(
 *   { targetType: 'post', postId: string }
 *   | { targetType: 'postComment', postId: string, commentId: string }
 *   | { targetType: 'event', eventId: string }
 *   | { targetType: 'eventComment', eventId: string, commentId: string }
 * )} TargetIdentity
 */

/**
 * @typedef {object} ReportRequestPayload
 * @property {ReportTargetType} targetType - Target type.
 * @property {Record<string, unknown>} target - Target ids for the type.
 * @property {ReportReason} reason - Stable reason key.
 * @property {string} [details] - Optional reporter details.
 * @property {string} [sourcePath] - Current app route context.
 */

/**
 * @typedef {object} ReportTargetSnapshot
 * @property {string} authorUid - Target author uid.
 * @property {string} authorDisplayName - Target author display name.
 * @property {string} title - Full title when available.
 * @property {string} excerpt - Body/comment excerpt.
 * @property {string} targetPath - Canonical app path for the target.
 * @property {unknown} createdAt - Target created timestamp or null.
 */

/**
 * @typedef {object} ReportDocument
 * @property {ReportTargetType} targetType - Target type.
 * @property {string} targetKey - Canonical target key.
 * @property {TargetIdentity} targetIdentity - Normalized target ids.
 * @property {string} reporterUid - Authenticated reporter uid.
 * @property {ReportReason} reason - Stable reason key.
 * @property {string} details - Trimmed details.
 * @property {ReportStatus} status - Current report status.
 * @property {unknown} createdAt - Server timestamp sentinel.
 * @property {string} sourcePath - Sanitized source path.
 * @property {ReportTargetSnapshot} targetSnapshot - Server-generated target snapshot.
 */

/**
 * @typedef {object} ReportRouteResult
 * @property {number} status - HTTP status code.
 * @property {Record<string, unknown>} body - JSON response body.
 */

export {};
