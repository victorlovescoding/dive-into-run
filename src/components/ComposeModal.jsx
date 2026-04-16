'use client';

import { useEffect, useRef } from 'react';
import styles from './ComposeModal.module.css';

/**
 * 判斷表單是否有內容。
 * @param {string} title - 標題值。
 * @param {string} content - 內容值。
 * @returns {boolean} 有任一欄位有內容時回傳 true。
 */
function hasContent(title, content) {
  return title.trim() !== '' || content.trim() !== '';
}

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
}) {
  // -- Refs (讓 useEffect 內的 listener 讀到最新值，避免每次 keystroke 重新註冊) --

  const titleRef = useRef(title);
  const contentRef = useRef(content);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // -- Effects --

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    /** @param {MouseEvent} e - native click 事件。 */
    function handleBackdropClick(e) {
      const rect = dialog.getBoundingClientRect();
      const clickedOutside =
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom;
      if (clickedOutside && !hasContent(titleRef.current, contentRef.current)) {
        dialog.close();
      }
    }

    dialog.addEventListener('click', handleBackdropClick);
    return () => dialog.removeEventListener('click', handleBackdropClick);
  }, [dialogRef]);

  // -- Handlers --

  /**
   * Escape 按下時，有內容則阻止關閉。
   * @param {import('react').SyntheticEvent<HTMLDialogElement>} e - cancel 事件。
   */
  function handleCancel(e) {
    if (hasContent(title, content)) {
      e.preventDefault();
    }
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
          onClick={() => dialogRef.current?.close()}
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
          onChange={(e) => onTitleChange(e.target.value)}
        />
        <textarea
          className={styles.contentTextarea}
          placeholder="分享你的想法..."
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
        />
        <button type="submit" className={styles.submitButton} disabled={submitDisabled}>
          {submitText}
        </button>
      </form>
    </dialog>
  );
}
