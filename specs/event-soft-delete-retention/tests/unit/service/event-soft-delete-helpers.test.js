import { describe, expect, it } from 'vitest';
import {
  SOFT_DELETE_RETENTION_DAYS,
  buildSoftDeletePayload,
  getSoftDeletePurgeDate,
  isActiveSoftDeleteRecord,
  isSoftDeletedRecord,
} from '@/repo/soft-delete-retention';
import {
  POST_DELETE_RETENTION_DAYS,
  addDays,
  buildSoftDeletePayload as buildPostSoftDeletePayload,
  isSoftDeletedRecord as isPostSoftDeletedRecord,
} from '@/repo/post-soft-delete';

describe('event soft delete retention helpers', () => {
  it('calculates deletedPurgeAt exactly 90 days after delete time', () => {
    const deletedAt = new Date('2026-05-28T03:04:05.006Z');
    const deletedPurgeAt = getSoftDeletePurgeDate(deletedAt);

    expect(SOFT_DELETE_RETENTION_DAYS).toBe(90);
    expect(deletedPurgeAt).toEqual(new Date('2026-08-26T03:04:05.006Z'));
    expect(deletedPurgeAt.getTime() - deletedAt.getTime()).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it('builds deletedAt, deletedByUid, and deletedPurgeAt fields', () => {
    const deletedAtValue = { seconds: 1 };
    const deletedPurgeAtValue = { seconds: 2 };

    expect(
      buildSoftDeletePayload({
        actorUid: 'user-1',
        deletedAtValue,
        purgeAtValue: deletedPurgeAtValue,
      }),
    ).toEqual({
      deletedAt: deletedAtValue,
      deletedByUid: 'user-1',
      deletedPurgeAt: deletedPurgeAtValue,
    });
  });

  it('treats legacy records without deletedAt as active', () => {
    const legacyEvent = { id: 'event-1', title: 'Morning run' };

    expect(isSoftDeletedRecord(legacyEvent)).toBe(false);
    expect(isActiveSoftDeleteRecord(legacyEvent)).toBe(true);
  });

  it('treats timestamp-sentinel deleted records as deleted', () => {
    const deletedComment = {
      id: 'comment-1',
      deletedAt: { seconds: 1, nanoseconds: 0 },
    };

    expect(isSoftDeletedRecord(deletedComment)).toBe(true);
    expect(isActiveSoftDeleteRecord(deletedComment)).toBe(false);
  });

  it('keeps existing post soft-delete helper exports compatible', () => {
    const deletedAt = new Date('2026-05-28T03:04:05.006Z');
    const deletedAtValue = { seconds: 1 };
    const purgeAtValue = { seconds: 2 };

    expect(POST_DELETE_RETENTION_DAYS).toBe(SOFT_DELETE_RETENTION_DAYS);
    expect(addDays(deletedAt, POST_DELETE_RETENTION_DAYS)).toEqual(
      new Date('2026-08-26T03:04:05.006Z'),
    );
    expect(
      buildPostSoftDeletePayload({
        actorUid: 'post-user',
        deletedAtValue,
        purgeAtValue,
      }),
    ).toEqual({
      deletedAt: deletedAtValue,
      deletedByUid: 'post-user',
      deletedPurgeAt: purgeAtValue,
    });
    expect(isPostSoftDeletedRecord({ deletedAt: null })).toBe(true);
  });
});
