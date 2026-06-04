import { describe, expect, test } from 'vitest';
import { buildUpdatePostPayload } from '@/service/post-service';

const EDITED_AT = { kind: 'serverTimestamp' };

describe('post-service article edit history payloads', () => {
  test('builds a parent update and pre-edit history payload for article edits', () => {
    const result = buildUpdatePostPayload({
      title: '  New title  ',
      content: '  New content  ',
      currentPost: {
        id: 'post-1',
        title: 'Old title',
        content: 'Old content',
      },
      updatedAtValue: EDITED_AT,
      historyId: 'history-1',
    });

    expect(result).toEqual({
      historyPayload: {
        title: 'Old title',
        content: 'Old content',
        editedAt: EDITED_AT,
      },
      postUpdate: {
        title: 'New title',
        content: 'New content',
        updatedAt: EDITED_AT,
        isEdited: true,
        lastEditHistoryId: 'history-1',
      },
    });
  });

  test('rejects article edits that do not change title or content', () => {
    expect(() =>
      buildUpdatePostPayload({
        title: 'Same title',
        content: 'Same content',
        currentPost: {
          id: 'post-1',
          title: 'Same title',
          content: 'Same content',
        },
        updatedAtValue: EDITED_AT,
        historyId: 'history-1',
      }),
    ).toThrow('updatePost: content unchanged');
  });
});
