import { describe, expect, it } from 'vitest';
import { isPublicEventCommentVisible } from '@/service/event-comment-service';

describe('event comment soft-delete visibility', () => {
  it('treats legacy comments without deletedAt as visible', () => {
    expect(isPublicEventCommentVisible({ content: 'Still active' })).toBe(true);
  });

  it('hides soft-deleted event comments', () => {
    expect(
      isPublicEventCommentVisible({
        content: 'Deleted comment',
        deletedAt: { seconds: 1 },
        deletedByUid: 'actor-1',
        deletedPurgeAt: { seconds: 2 },
      }),
    ).toBe(false);
  });

  it('keeps account deletion hiding intact', () => {
    expect(
      isPublicEventCommentVisible({
        content: 'Hidden by account deletion',
        accountDeletionHidden: true,
      }),
    ).toBe(false);
  });
});
