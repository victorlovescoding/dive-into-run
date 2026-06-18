import { createHash } from 'node:crypto';
import {
  REPORT_DETAILS_MAX_LENGTH,
  REPORT_REASON_VALUES,
  REPORT_SERVER_OWNED_FIELDS,
  REPORT_SOURCE_PATH_MAX_LENGTH,
  REPORT_STATUS,
  REPORT_TARGET_TYPES,
  REPORT_TARGET_TYPE_VALUES,
} from '@/constants/report-constants';

class ReportValidationError extends Error {
  constructor(message = 'Invalid report request') {
    super(message);
    this.name = 'ReportValidationError';
    this.code = 'report_validation_error';
  }
}

const PROTOCOL_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const URL_LIKE_PATTERN = /(?:^[a-z][a-z0-9+.-]*:|:\/\/|^www\.)/i;
const MARKUP_PATTERN = /<[^>]*>|<|>/i;
const SCRIPT_PATTERN = /script/i;

const TARGET_CONTRACTS = Object.freeze({
  [REPORT_TARGET_TYPES.POST]: Object.freeze({
    idKeys: Object.freeze(['postId']),
    buildTargetKey: ({ postId }) => `posts/${postId}`,
    buildTargetPath: ({ postId }) => `/posts/${postId}`,
  }),
  [REPORT_TARGET_TYPES.POST_COMMENT]: Object.freeze({
    idKeys: Object.freeze(['postId', 'commentId']),
    buildTargetKey: ({ postId, commentId }) => `posts/${postId}/comments/${commentId}`,
    buildTargetPath: ({ postId, commentId }) => `/posts/${postId}?commentId=${commentId}`,
  }),
  [REPORT_TARGET_TYPES.EVENT]: Object.freeze({
    idKeys: Object.freeze(['eventId']),
    buildTargetKey: ({ eventId }) => `events/${eventId}`,
    buildTargetPath: ({ eventId }) => `/events/${eventId}`,
  }),
  [REPORT_TARGET_TYPES.EVENT_COMMENT]: Object.freeze({
    idKeys: Object.freeze(['eventId', 'commentId']),
    buildTargetKey: ({ eventId, commentId }) => `events/${eventId}/comments/${commentId}`,
    buildTargetPath: ({ eventId, commentId }) => `/events/${eventId}?commentId=${commentId}`,
  }),
});

const REPORT_TARGET_TYPE_SET = new Set(
  /** @type {readonly string[]} */ (REPORT_TARGET_TYPE_VALUES),
);
const REPORT_REASON_SET = new Set(/** @type {readonly string[]} */ (REPORT_REASON_VALUES));

/**
 * Throws a report validation error.
 * @param {string} message - Error message.
 * @returns {never} Never returns.
 */
function invalid(message) {
  throw new ReportValidationError(message);
}

/**
 * Checks whether a value is a plain object.
 * @param {unknown} value - Candidate value.
 * @returns {value is Record<string, unknown>} Whether the value is object-like.
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Checks whether text contains ASCII control characters.
 * @param {string} value - Candidate text.
 * @returns {boolean} Whether control characters exist.
 */
function hasControlCharacter(value) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

/**
 * Checks whether an id contains unsafe path or payload content.
 * @param {string} value - Trimmed id.
 * @returns {boolean} Whether the id is invalid.
 */
function isInvalidTargetId(value) {
  return (
    value.length === 0 ||
    value.includes('/') ||
    hasControlCharacter(value) ||
    URL_LIKE_PATTERN.test(value) ||
    PROTOCOL_PATTERN.test(value) ||
    MARKUP_PATTERN.test(value) ||
    SCRIPT_PATTERN.test(value)
  );
}

/**
 * Normalizes and validates a target id string.
 * @param {unknown} rawValue - Candidate id.
 * @param {string} key - Id key.
 * @returns {string} Trimmed id.
 */
function normalizeTargetId(rawValue, key) {
  if (typeof rawValue !== 'string') {
    invalid(`Invalid ${key}`);
  }

  const value = rawValue.trim();
  if (isInvalidTargetId(value)) {
    invalid(`Invalid ${key}`);
  }

  return value;
}

/**
 * Checks whether a source path can be persisted as app-relative context.
 * @param {string} value - Trimmed source path.
 * @returns {boolean} Whether the source path is safe.
 */
function isSafeSourcePath(value) {
  return (
    value.length > 0 &&
    value.length <= REPORT_SOURCE_PATH_MAX_LENGTH &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !hasControlCharacter(value) &&
    !URL_LIKE_PATTERN.test(value) &&
    !MARKUP_PATTERN.test(value) &&
    !SCRIPT_PATTERN.test(value)
  );
}

/**
 * Sanitizes client source path context.
 * @param {unknown} sourcePath - Candidate source path.
 * @param {string} fallbackPath - Canonical target path.
 * @returns {string} Safe source path.
 */
function sanitizeSourcePath(sourcePath, fallbackPath) {
  if (typeof sourcePath !== 'string') return fallbackPath;
  const value = sourcePath.trim();
  return isSafeSourcePath(value) ? value : fallbackPath;
}

/**
 * Validates server-owned fields are absent from the request.
 * @param {Record<string, unknown>} payload - Request payload.
 */
function assertNoServerOwnedFields(payload) {
  const serverOwnedField = REPORT_SERVER_OWNED_FIELDS.find((field) =>
    Object.prototype.hasOwnProperty.call(payload, field),
  );
  if (serverOwnedField) {
    invalid(`Server-owned field is not allowed: ${serverOwnedField}`);
  }
}

/**
 * Builds a normalized target identity from request target ids.
 * @param {string} targetType - Target type.
 * @param {unknown} rawTarget - Request target payload.
 * @returns {{ targetIdentity: import('@/types/report-types').TargetIdentity, targetKey: string, targetPath: string }} Normalized target metadata.
 */
function normalizeTargetIdentity(targetType, rawTarget) {
  const contract = TARGET_CONTRACTS[targetType];
  if (!contract || !isPlainObject(rawTarget)) {
    invalid('Invalid target');
  }

  const targetKeys = Object.keys(rawTarget);
  if (
    targetKeys.length !== contract.idKeys.length ||
    !contract.idKeys.every((key) => targetKeys.includes(key))
  ) {
    invalid('Invalid target ids');
  }

  const ids = Object.fromEntries(
    contract.idKeys.map((key) => [key, normalizeTargetId(rawTarget[key], key)]),
  );
  const targetIdentity = /** @type {import('@/types/report-types').TargetIdentity} */ ({
    targetType,
    ...ids,
  });

  return {
    targetIdentity,
    targetKey: contract.buildTargetKey(ids),
    targetPath: contract.buildTargetPath(ids),
  };
}

/**
 * Normalizes and validates the report API request body.
 * @param {unknown} payload - Raw request payload.
 * @returns {{
 *   targetType: import('@/types/report-types').ReportTargetType,
 *   targetIdentity: import('@/types/report-types').TargetIdentity,
 *   targetKey: string,
 *   targetPath: string,
 *   reason: import('@/types/report-types').ReportReason,
 *   details: string,
 *   sourcePath: string,
 * }} Normalized report request.
 */
export function normalizeReportRequest(payload) {
  if (!isPlainObject(payload)) {
    invalid('Payload must be an object');
  }
  const payloadObject = /** @type {Record<string, unknown>} */ (payload);
  assertNoServerOwnedFields(payloadObject);

  const { targetType, target, reason } = payloadObject;
  if (typeof targetType !== 'string' || !REPORT_TARGET_TYPE_SET.has(targetType)) {
    invalid('Invalid targetType');
  }
  if (typeof reason !== 'string' || !REPORT_REASON_SET.has(reason)) {
    invalid('Invalid reason');
  }

  const rawDetails = payloadObject.details ?? '';
  if (typeof rawDetails !== 'string') {
    invalid('Invalid details');
  }
  const details = rawDetails.trim();
  if (details.length > REPORT_DETAILS_MAX_LENGTH) {
    invalid('Details too long');
  }
  if (reason === 'other' && details.length === 0) {
    invalid('Other reason requires details');
  }

  const safeTargetType = /** @type {import('@/types/report-types').ReportTargetType} */ (
    targetType
  );
  const safeReason = /** @type {import('@/types/report-types').ReportReason} */ (reason);
  const { targetIdentity, targetKey, targetPath } = normalizeTargetIdentity(safeTargetType, target);

  return {
    targetType: safeTargetType,
    targetIdentity,
    targetKey,
    targetPath,
    reason: safeReason,
    details,
    sourcePath: sanitizeSourcePath(payloadObject.sourcePath, targetPath),
  };
}

/**
 * Builds the deterministic report document id.
 * @param {object} params - Hash params.
 * @param {string} params.reporterUid - Reporter uid.
 * @param {string} params.targetType - Target type.
 * @param {string} params.targetKey - Canonical target key.
 * @returns {string} Lowercase sha256 hex document id.
 */
export function buildReportId({ reporterUid, targetType, targetKey }) {
  return createHash('sha256').update(`${reporterUid}:${targetType}:${targetKey}`).digest('hex');
}

/**
 * Builds the report document saved to Firestore.
 * @param {object} params - Document params.
 * @param {ReturnType<typeof normalizeReportRequest>} params.normalizedRequest - Normalized request.
 * @param {string} params.reporterUid - Authenticated reporter uid.
 * @param {import('@/types/report-types').ReportTargetSnapshot} params.targetSnapshot - Server snapshot.
 * @param {unknown} params.createdAt - Server timestamp sentinel.
 * @returns {{ reportId: string, document: import('@/types/report-types').ReportDocument }} Report id and document.
 */
export function buildReportDocument({
  normalizedRequest,
  reporterUid,
  targetSnapshot,
  createdAt,
}) {
  const reportId = buildReportId({
    reporterUid,
    targetType: normalizedRequest.targetType,
    targetKey: normalizedRequest.targetKey,
  });

  return {
    reportId,
    document: {
      targetType: normalizedRequest.targetType,
      targetKey: normalizedRequest.targetKey,
      targetIdentity: normalizedRequest.targetIdentity,
      reporterUid,
      reason: normalizedRequest.reason,
      details: normalizedRequest.details,
      status: REPORT_STATUS.OPEN,
      createdAt,
      sourcePath: normalizedRequest.sourcePath,
      targetSnapshot,
    },
  };
}

export { ReportValidationError };
