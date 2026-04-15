'use client';

import { useEffect } from 'react';
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
 * 發文/編輯文章 Modal。
 * @param {object} props - 元件屬性。
 * @param {import('react').RefObject<HTMLDialogElement | null>} props.dialogRef - dialog 元素 ref。
 * @param {string} props.title - 標題輸入值。
 * @param {string} props.content - 內容輸入值。
 * @param {(value: string) => void} props.onTitleChange - 標題變更回呼。
 * @param {(value: string) => void} props.onContentChange - 內容變更回呼。
 * @param {(e: import('react').FormEvent<HTMLFormElement>) => void} props.onSubmit - 表單送出回呼。
 * @param {boolean} [props.isEditing] - 是否為編輯模式，預設 false。
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
}) {
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
      if (clickedOutside && !hasContent(title, content)) {
        dialog.close();
      }
    }

    dialog.addEventListener('click', handleBackdropClick);
    return () => dialog.removeEventListener('click', handleBackdropClick);
  }, [dialogRef, title, content]);

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
  const submitText = isEditing ? '更新' : '發布';

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
        <button type="submit" className={styles.submitButton}>
          {submitText}
        </button>
      </form>
    </dialog>
  );
}
