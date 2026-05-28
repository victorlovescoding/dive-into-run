'use client';

import { useEffect } from 'react';
import styles from './ComposeModal.module.css';

/**
 * 依編輯/送出中狀態決定送出按鈕文字。
 * 編輯模式：送出中顯示「更新中…」，否則「更新」；新增模式固定「發布」。
 * 拆成 helper 以避開 nested ternary（Constitution IX）。
 * @param {boolean} isEditing - 是否為編輯模式。
 * @param {boolean} isSubmitting - 是否送出中。
 * @returns {string} 按鈕顯示文字。
 */
function getSubmitText(isEditing, isSubmitting) {
  if (!isEditing) return '發布';
  return isSubmitting ? '更新中…' : '更新';
}

/**
 * 發文/編輯文章 Modal。
 * @param {object} props - 元件屬性。
 * @param {import('react').RefObject<HTMLDialogElement | null>} props.dialogRef - dialog 元素 ref。
 * @param {string} props.title - 標題輸入值。
 * @param {string} props.content - 內容輸入值。
 * @param {(value: string) => void} props.onTitleChange - 標題變更回呼。
 * @param {(value: string) => void} props.onContentChange - 內容變更回呼。
 * @param {(e: import('react').FormEvent<HTMLFormElement>) => void} props.onSubmit - 表單送出回呼。
 * @param {boolean} [props.isEditing] - 是否為編輯模式，預設 false。
 * @param {string} [props.originalTitle] - 編輯模式下做為 dirty 比較基準的原始標題；非編輯模式可省略。
 * @param {string} [props.originalContent] - 編輯模式下做為 dirty 比較基準的原始內文；非編輯模式可省略。
 * @param {boolean} [props.isSubmitting] - 送出請求是否進行中，用於停用按鈕並切換 label。
 * @param {() => void} [props.onRequestClose] - 使用者要求關閉 composer 時呼叫。
 * @param {boolean} [props.isDraftConfirmOpen] - 是否顯示草稿確認面板。
 * @param {() => void} [props.onSaveDraft] - 點擊「存草稿」時呼叫。
 * @param {() => void} [props.onContinueEditing] - 點擊「繼續編輯」時呼叫。
 * @param {() => void} [props.onDiscardDraft] - 點擊「不儲存並關閉」時呼叫。
 * @returns {import('react').ReactElement} Modal 元件。
 */
export default function ComposeModal({
  dialogRef,
  title,
  content,
  onTitleChange,
  onContentChange,
  onSubmit,
  isEditing = false,
  originalTitle,
  originalContent,
  isSubmitting,
  onRequestClose = () => dialogRef.current?.close(),
  isDraftConfirmOpen = false,
  onSaveDraft = () => {},
  onContinueEditing = () => {},
  onDiscardDraft = () => {},
}) {
  // -- Effects --

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    /** @param {MouseEvent} e - native click 事件。 */
    function handleBackdropClick(e) {
      if (e.target !== dialog) return;

      const rect = dialog.getBoundingClientRect();
      const clickedOutside =
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom;
      if (clickedOutside) {
        onRequestClose();
      }
    }

    dialog.addEventListener('click', handleBackdropClick);
    return () => dialog.removeEventListener('click', handleBackdropClick);
  }, [dialogRef, onRequestClose]);

  // -- Handlers --

  /**
   * Escape 按下時交由外部 close guard 決定是否關閉。
   * @param {import('react').SyntheticEvent<HTMLDialogElement>} e - cancel 事件。
   */
  function handleCancel(e) {
    e.preventDefault();
    onRequestClose();
  }

  // -- Derived values --

  const headerText = isEditing ? '編輯文章' : '發表文章';
  const isDirty = isEditing
    ? title.trim() !== (originalTitle ?? '').trim() ||
      content.trim() !== (originalContent ?? '').trim()
    : true;
  const submitDisabled = (isEditing && !isDirty) || !!isSubmitting;
  const submitText = getSubmitText(isEditing, !!isSubmitting);

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={handleCancel}>
      <div className={styles.header}>
        <h2 className={styles.headerTitle}>{headerText}</h2>
        <button
          type="button"
          className={styles.closeButton}
          aria-label="關閉"
          disabled={isDraftConfirmOpen}
          onClick={() => onRequestClose()}
        >
          ✕
        </button>
      </div>
      <form className={styles.form} onSubmit={onSubmit}>
        <input
          type="text"
          className={styles.titleInput}
          placeholder="標題"
          value={title}
          disabled={isDraftConfirmOpen}
          onChange={(e) => onTitleChange(e.target.value)}
        />
        <textarea
          className={styles.contentTextarea}
          placeholder="分享你的想法..."
          value={content}
          disabled={isDraftConfirmOpen}
          onChange={(e) => onContentChange(e.target.value)}
        />
        <button
          type="submit"
          className={styles.submitButton}
          disabled={isDraftConfirmOpen || submitDisabled}
        >
          {submitText}
        </button>
      </form>
      {isDraftConfirmOpen && (
        <div className={styles.confirmOverlay}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="compose-draft-confirm-title"
            aria-describedby="compose-draft-confirm-body"
            className={styles.confirmDialog}
          >
            <h3 id="compose-draft-confirm-title" className={styles.confirmTitle}>
              要儲存這篇草稿嗎？
            </h3>
            <p id="compose-draft-confirm-body" className={styles.confirmBody}>
              下次開啟文章編輯器時，可以繼續編輯目前內容。
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={`${styles.confirmButton} ${styles.confirmPrimary}`}
                onClick={() => onSaveDraft()}
              >
                存草稿
              </button>
              <button
                type="button"
                className={`${styles.confirmButton} ${styles.confirmSecondary}`}
                onClick={() => onContinueEditing()}
              >
                繼續編輯
              </button>
              <button
                type="button"
                className={`${styles.confirmButton} ${styles.confirmDanger}`}
                onClick={() => onDiscardDraft()}
              >
                不儲存並關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
