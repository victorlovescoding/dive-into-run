import { describe, expect, it } from 'vitest';
import { isPublicEventRecordVisible, toEventDataList } from '@/service/event-service';

/**
 * Build a minimal Firestore snapshot double.
 * @param {string} id - Snapshot ID.
 * @param {object} data - Snapshot data.
 * @returns {{ id: string, data: () => object }} Snapshot double.
 */
function snapshot(id, data) {
  return {
    id,
    data: () => data,
  };
}

describe('event-service soft delete filtering', () => {
  it('hides soft-deleted event records from public visibility', () => {
    expect(isPublicEventRecordVisible({ title: 'Morning run' })).toBe(true);
    expect(
      isPublicEventRecordVisible({
        title: 'Deleted run',
        deletedAt: { seconds: 1, nanoseconds: 0 },
      }),
    ).toBe(false);
    expect(
      isPublicEventRecordVisible({
        title: 'Deleted sentinel run',
        deletedAt: null,
      }),
    ).toBe(false);
    expect(
      isPublicEventRecordVisible({
        title: 'Hidden host run',
        accountDeletionHidden: true,
      }),
    ).toBe(false);
  });

  it('omits soft-deleted snapshots from event list data', () => {
    const events = toEventDataList([
      snapshot('active-1', { title: 'Active run', time: { seconds: 2 } }),
      snapshot('deleted-1', {
        title: 'Deleted run',
        time: { seconds: 1 },
        deletedAt: { seconds: 1, nanoseconds: 0 },
      }),
    ]);

    expect(events).toEqual([
      {
        id: 'active-1',
        title: 'Active run',
        time: { seconds: 2 },
      },
    ]);
  });
});
