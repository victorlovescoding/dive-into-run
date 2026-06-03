import { describe, expect, test } from 'vitest';
import buildCommentEditHistoryPayload from '@/service/comment-edit-history-service';
import {
  buildUpdateCommentPayload as buildEventUpdateCommentPayload,
} from '@/service/event-comment-service';
import {
  buildUpdateCommentPayload as buildPostUpdateCommentPayload,
} from '@/service/post-service';

describe('buildCommentEditHistoryPayload', () => {
  test('trims new text and builds history plus configured current field update', () => {
    const editedAt = { seconds: 10 };

    const payload = buildCommentEditHistoryPayload({
      newText: '  after edit  ',
      oldText: 'before edit',
      currentTextField: 'comment',
      updatedAtValue: editedAt,
    });

    expect(payload).toEqual({
      historyPayload: {
        content: 'before edit',
        editedAt,
      },
      commentUpdate: {
        comment: 'after edit',
        updatedAt: editedAt,
        isEdited: true,
      },
    });
  });

  test('rejects empty new text', () => {
    expect(() =>
      buildCommentEditHistoryPayload({
        newText: '   ',
        oldText: 'before edit',
        currentTextField: 'content',
        updatedAtValue: {},
      }),
    ).toThrow('updateComment: content is required');
  });

  test('rejects unchanged trimmed text', () => {
    expect(() =>
      buildCommentEditHistoryPayload({
        newText: '  same text  ',
        oldText: 'same text',
        currentTextField: 'content',
        updatedAtValue: {},
      }),
    ).toThrow('updateComment: content unchanged');
  });
});

describe('event comment update payload contract', () => {
  test('keeps content on current event comment and history payload', () => {
    const editedAt = { seconds: 20 };

    const payload = buildEventUpdateCommentPayload(
      '  new event content  ',
      'old event content',
      editedAt,
    );

    expect(payload).toEqual({
      historyPayload: {
        content: 'old event content',
        editedAt,
      },
      commentUpdate: {
        content: 'new event content',
        updatedAt: editedAt,
        isEdited: true,
      },
    });
  });

  test('preserves event comment 500 character limit', () => {
    expect(() =>
      buildEventUpdateCommentPayload(`${'a'.repeat(500)}b`, 'old event content', {}),
    ).toThrow('updateComment: newContent exceeds 500 characters');
  });
});

describe('post comment update payload contract', () => {
  test('keeps comment on current post comment and content on history payload', () => {
    const updatedAt = { seconds: 30 };

    const payload = buildPostUpdateCommentPayload({
      comment: '  new post comment  ',
      currentComment: 'old post comment',
      updatedAtValue: updatedAt,
    });

    expect(payload).toEqual({
      historyPayload: {
        content: 'old post comment',
        editedAt: updatedAt,
      },
      commentUpdate: {
        comment: 'new post comment',
        updatedAt,
        isEdited: true,
      },
    });
  });
});
