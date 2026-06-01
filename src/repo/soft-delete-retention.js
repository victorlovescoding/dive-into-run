/** @type {number} Soft-delete retention window in days. */
export const SOFT_DELETE_RETENTION_DAYS = 90;

/**
 * Calculates a date offset by the provided number of days.
 * @param {Date} date - Base date.
 * @param {number} days - Number of days to add.
 * @returns {Date} New offset date.
 */
export function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Calculates the soft-delete purge date for a delete time.
 * @param {Date} deletedAt - Delete time.
 * @returns {Date} Purge time exactly after the retention window.
 */
export function getSoftDeletePurgeDate(deletedAt) {
  return addDays(deletedAt, SOFT_DELETE_RETENTION_DAYS);
}

/**
 * Builds common soft-delete retention fields.
 * @param {object} root0 - Parameters.
 * @param {string | null | undefined} root0.actorUid - UID performing the delete.
 * @param {unknown} root0.deletedAtValue - Value written to `deletedAt`.
 * @param {unknown} root0.purgeAtValue - Value written to `deletedPurgeAt`.
 * @returns {{ deletedAt: unknown, deletedByUid: string, deletedPurgeAt: unknown }} Soft-delete fields.
 */
export function buildSoftDeletePayload({ actorUid, deletedAtValue, purgeAtValue }) {
  if (!actorUid) throw new Error('softDelete: actorUid is required');
  return { deletedAt: deletedAtValue, deletedByUid: actorUid, deletedPurgeAt: purgeAtValue };
}

/**
 * Checks whether a normalized record has been soft-deleted.
 * @param {Record<string, unknown> | null | undefined} record - Normalized record.
 * @returns {boolean} True when the record owns a `deletedAt` field.
 */
export function isSoftDeletedRecord(record) {
  return !!record && Object.prototype.hasOwnProperty.call(record, 'deletedAt');
}

/**
 * Checks whether a normalized record is active for soft-delete purposes.
 * @param {Record<string, unknown> | null | undefined} record - Normalized record.
 * @returns {boolean} True when the record exists and does not own `deletedAt`.
 */
export function isActiveSoftDeleteRecord(record) {
  return !!record && !isSoftDeletedRecord(record);
}
