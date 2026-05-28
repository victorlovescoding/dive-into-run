import { describe, expect, it } from 'vitest';
import {
  POST_DELETE_RETENTION_DAYS,
  addDays,
  buildSoftDeletePayload,
  isActiveRecord,
  isSoftDeletedRecord,
} from '@/service/post-service';

describe('post-service soft delete helpers', () => {
  it('calculates purge time exactly 90 days after delete time', () => {
    const deletedAt = new Date('2026-05-28T03:04:05.006Z');
    const purgeAt = addDays(deletedAt, POST_DELETE_RETENTION_DAYS);

    expect(purgeAt).toEqual(new Date('2026-08-26T03:04:05.006Z'));
    expect(purgeAt.getTime() - deletedAt.getTime()).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it('builds the soft delete payload with actor and purge fields', () => {
    const deletedAtValue = { seconds: 1 };
    const purgeAtValue = { seconds: 2 };

    expect(
      buildSoftDeletePayload({
        actorUid: 'user-1',
        deletedAtValue,
        purgeAtValue,
      }),
    ).toEqual({
      deletedAt: deletedAtValue,
      deletedByUid: 'user-1',
      deletedPurgeAt: purgeAtValue,
    });
  });

  it('treats legacy records without deletedAt as active', () => {
    const record = { id: 'post-1', title: 'Active post' };

    expect(isSoftDeletedRecord(record)).toBe(false);
    expect(isActiveRecord(record)).toBe(true);
  });

  it('treats records with deletedAt as deleted', () => {
    const record = { id: 'comment-1', deletedAt: { seconds: 1 } };

    expect(isSoftDeletedRecord(record)).toBe(true);
    expect(isActiveRecord(record)).toBe(false);
  });
});
