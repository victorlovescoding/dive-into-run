import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import CommentHistoryModal from './CommentHistoryModal';

/** @type {import('firebase/firestore').Timestamp} */
const UPDATED_AT = {
  seconds: 1767323045,
  nanoseconds: 0,
  toDate: () => new Date('2026-01-02T03:04:05.000Z'),
  toMillis: () => new Date('2026-01-02T03:04:05.000Z').getTime(),
  isEqual: (other) => other.seconds === 1767323045 && other.nanoseconds === 0,
  toJSON: () => ({ seconds: 1767323045, nanoseconds: 0, type: 'timestamp' }),
  valueOf: () => '1767323045.000000000',
};

/**
 * 建立完整留言測試資料。
 * @param {Partial<import('@/lib/firebase-comments').CommentData>} overrides - 覆寫欄位。
 * @returns {import('@/lib/firebase-comments').CommentData} 留言測試資料。
 */
function createComment(overrides = {}) {
  return {
    id: 'comment-1',
    authorUid: 'user-1',
    authorName: 'Runner',
    authorPhotoURL: '',
    content: 'Current comment',
    createdAt: UPDATED_AT,
    updatedAt: UPDATED_AT,
    isEdited: true,
    ...overrides,
  };
}

/**
 * 建立完整留言歷史測試資料。
 * @param {Partial<import('@/lib/firebase-comments').CommentHistoryEntry>} overrides - 覆寫欄位。
 * @returns {import('@/lib/firebase-comments').CommentHistoryEntry} 留言歷史測試資料。
 */
function createHistory(overrides = {}) {
  return {
    id: 'history-1',
    content: 'Previous comment',
    editedAt: UPDATED_AT,
    ...overrides,
  };
};

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal() {
    this.open = true;
  });
});

describe('CommentHistoryModal compatibility wrapper', () => {
  test('accepts existing comment props and renders current plus newest-first history', () => {
    render(
      <CommentHistoryModal
        comment={createComment()}
        history={[
          createHistory({ id: 'oldest', content: 'Original comment' }),
          createHistory({ id: 'newest', content: 'Previous comment' }),
        ]}
        historyError={null}
        onClose={vi.fn()}
      />,
    );

    const entries = screen.getAllByRole('listitem');

    expect(within(entries[0]).getByText('目前版本')).toBeInTheDocument();
    expect(within(entries[0]).getByText('Current comment')).toBeInTheDocument();
    expect(within(entries[1]).getByText('Previous comment')).toBeInTheDocument();
    expect(within(entries[2]).getByText('原始版本')).toBeInTheDocument();
    expect(within(entries[2]).getByText('Original comment')).toBeInTheDocument();
  });

  test('keeps existing empty and error states', () => {
    const { rerender } = render(
      <CommentHistoryModal
        comment={createComment()}
        history={[]}
        historyError={null}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('沒有編輯記錄')).toBeInTheDocument();

    rerender(
      <CommentHistoryModal
        comment={createComment()}
        history={[]}
        historyError="載入編輯記錄失敗"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('載入編輯記錄失敗');
    expect(screen.queryByText('沒有編輯記錄')).not.toBeInTheDocument();
  });
});
