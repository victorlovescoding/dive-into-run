export const ACCOUNT_DELETION_STATUS_ACTIVE = 'active';
export const ACCOUNT_DELETION_STATUS_PENDING = 'pendingDeletion';

export const ACCOUNT_DELETION_REQUEST_STATUS_PENDING = 'pending';
export const ACCOUNT_DELETION_REQUEST_STATUS_FINALIZING = 'finalizing';
export const ACCOUNT_DELETION_REQUEST_STATUS_FAILED = 'failed';

export const ACCOUNT_DELETION_WAIT_DAYS = 30;
export const ACCOUNT_DELETION_WAIT_MS =
  ACCOUNT_DELETION_WAIT_DAYS * 24 * 60 * 60 * 1000;

export const ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS = 5 * 60;

export const ACCOUNT_DELETION_DELETED_ACTOR_UID = 'deleted-user';
export const ACCOUNT_DELETION_DELETED_ACTOR_NAME = '已刪除使用者';
export const ACCOUNT_DELETION_REASON = 'accountDeletion';

/**
 * Computes the permanent deletion timestamp for a new request.
 * @param {Date} [now] - Base time.
 * @returns {Date} Scheduled deletion time.
 */
export function getAccountDeletionScheduledDate(now = new Date()) {
  return new Date(now.getTime() + ACCOUNT_DELETION_WAIT_MS);
}

/**
 * Checks whether an account is pending deletion.
 * @param {string | null | undefined} accountStatus - Account status field.
 * @returns {boolean} Whether the account is pending deletion.
 */
export function isPendingDeletionAccount(accountStatus) {
  return accountStatus === ACCOUNT_DELETION_STATUS_PENDING;
}

/**
 * Checks whether a public record is hidden by account deletion.
 * @param {Record<string, unknown> | null | undefined} record - Firestore record.
 * @returns {boolean} Whether the record is hidden.
 */
export function isAccountDeletionHidden(record) {
  return record?.accountDeletionHidden === true;
}
