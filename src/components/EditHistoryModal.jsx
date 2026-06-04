'use client';

import { useEffect, useId, useMemo, useRef } from 'react';
import { formatCommentTimeFull } from '@/lib/event-helpers';
import styles from './CommentHistoryModal.module.css';

/**
 * @typedef {string | { toDate: () => Date } | null | undefined} EditHistoryTime
 */

/**
 * @typedef {object} EditHistoryEntry
 * @property {string} [id] - 歷史記錄 ID。
 * @property {string} [title] - 標題欄位，文章歷史可用。
 * @property {string} [content] - 內容欄位。
 * @property {EditHistoryTime} [updatedAt] - 目前版本更新時間。
 * @property {EditHistoryTime} [editedAt] - 歷史版本保存時間。
 */

/**
 * 取得可顯示的 entry time。
 * @param {EditHistoryEntry} entry - 編輯歷史 entry。
 * @returns {EditHistoryTime} timestamp-like value。
 */
function getEntryTime(entry) {
  return entry.updatedAt ?? entry.editedAt ?? null;
}

/**
 * Render title/content-capable entry body without resource-specific logic.
 * @param {{ entry: EditHistoryEntry }} props - Component props。
 * @returns {import('react').ReactElement} entry content。
 */
function EntryBody({ entry }) {
  return (
    <div className={styles.entryBody}>
      {entry.title && <h3 className={styles.entryTitle}>{entry.title}</h3>}
      {entry.content && <p className={styles.entryContent}>{entry.content}</p>}
    </div>
  );
}

/**
 * 通用編輯記錄 Modal。
 * @param {object} props - 元件 props。
 * @param {EditHistoryEntry} props.currentEntry - 目前版本資料。
 * @param {EditHistoryEntry[]} props.history - 編輯歷史（editedAt asc）。
 * @param {string | null} props.historyError - 載入錯誤訊息。
 * @param {() => void} props.onClose - 關閉回呼。
 * @param {string} [props.title] - modal 標題。
 * @returns {import('react').ReactElement} 編輯記錄 Modal 元件。
 */
export default function EditHistoryModal({
  currentEntry,
  history,
  historyError,
  onClose,
  title = '編輯記錄',
}) {
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  /** @param {import('react').SyntheticEvent<HTMLDialogElement>} e - dialog cancel 事件。 */
  function handleCancel(e) {
    e.preventDefault();
    onClose();
  }

  const reversedHistory = useMemo(() => [...history].reverse(), [history]);
  const historyEntries = reversedHistory.map((entry, index) => {
    const isOriginal = index === reversedHistory.length - 1;
    const entryTime = getEntryTime(entry);

    return (
      <li key={entry.id || index} className={styles.entry}>
        <div className={styles.entryHeader}>
          {isOriginal && <span className={styles.badgeOriginal}>原始版本</span>}
          {entryTime && <time className={styles.entryTime}>{formatCommentTimeFull(entryTime)}</time>}
        </div>
        <EntryBody entry={entry} />
      </li>
    );
  });
  const currentTime = getEntryTime(currentEntry);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={handleCancel}
    >
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="關閉">
          ✕
        </button>
      </div>
      {historyError && (
        <div role="alert" className={styles.errorAlert}>
          {historyError}
        </div>
      )}
      {!historyError && history.length === 0 && <p className={styles.emptyHint}>沒有編輯記錄</p>}
      {!historyError && history.length > 0 && (
        <ul className={styles.list}>
          <li className={styles.entry}>
            <div className={styles.entryHeader}>
              <span className={styles.badgeCurrent}>目前版本</span>
              {currentTime && (
                <time className={styles.entryTime}>{formatCommentTimeFull(currentTime)}</time>
              )}
            </div>
            <EntryBody entry={currentEntry} />
          </li>
          {historyEntries}
        </ul>
      )}
    </dialog>
  );
}
