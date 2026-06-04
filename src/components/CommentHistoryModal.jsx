'use client';

import EditHistoryModal from './EditHistoryModal';

/**
 * 留言編輯記錄 Modal 相容 wrapper。
 * @param {object} props - 元件 props。
 * @param {import('@/lib/firebase-comments').CommentData} props.comment - 當前留言。
 * @param {import('@/lib/firebase-comments').CommentHistoryEntry[]} props.history - 編輯歷史（editedAt asc）。
 * @param {string | null} props.historyError - 載入錯誤訊息。
 * @param {() => void} props.onClose - 關閉回呼。
 * @returns {import('react').ReactElement} 編輯記錄 Modal 元件。
 */
export default function CommentHistoryModal({ comment, history, historyError, onClose }) {
  return (
    <EditHistoryModal
      currentEntry={comment}
      history={history}
      historyError={historyError}
      onClose={onClose}
    />
  );
}
