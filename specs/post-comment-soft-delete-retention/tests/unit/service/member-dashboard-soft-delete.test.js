import { describe, expect, it } from 'vitest';
import { buildMyPostsPage, buildRawMyCommentItems } from '@/service/member-dashboard-service';

describe('member dashboard soft delete filtering', () => {
  it('omits soft-deleted posts from my posts', () => {
    const result = buildMyPostsPage(
      [
        {
          id: 'post-active',
          data: { title: 'Active post', authorUid: 'user-1' },
        },
        {
          id: 'post-deleted',
          data: { title: 'Deleted post', authorUid: 'user-1', deletedAt: { seconds: 1 } },
        },
      ],
      null,
    );

    expect(result.items).toEqual([
      {
        id: 'post-active',
        title: 'Active post',
        authorUid: 'user-1',
      },
    ]);
  });

  it('omits soft-deleted post comments from my comments', () => {
    const result = buildRawMyCommentItems([
      {
        id: 'comment-active',
        source: 'post',
        parentId: 'post-1',
        data: { comment: 'Active comment', createdAt: { seconds: 2 } },
      },
      {
        id: 'comment-deleted',
        source: 'post',
        parentId: 'post-1',
        data: { comment: 'Deleted comment', createdAt: { seconds: 1 }, deletedAt: { seconds: 1 } },
      },
    ]);

    expect(result).toEqual([
      {
        id: 'comment-active',
        source: 'post',
        parentId: 'post-1',
        text: 'Active comment',
        createdAt: { seconds: 2 },
        parentTitle: '',
      },
    ]);
  });
});
