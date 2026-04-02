'use client';

import { useState } from 'react';
import styles from './CommentInput.module.css';

/**
 * 浮動留言輸入框。
 * @param {object} props - 元件 props。
 * @param {(content: string) => void | Promise<void>} props.onSubmit - 送出留言回呼。
 * @param {boolean} props.isSubmitting - 是否送出中。
 * @returns {import('react').ReactElement} 留言輸入框元件。
 */
export default function CommentInput({ onSubmit, isSubmitting }) {
  const [content, setContent] = useState('');

  const trimmed = content.trim();
  const isDisabled = trimmed === '' || content.length > 500 || isSubmitting;

  /**
   * 觸發送出留言。
   */
  function handleSubmit() {
    if (!isDisabled) {
      onSubmit(content);
    }
  }

  /** @param {import('react').KeyboardEvent} e - 鍵盤事件。 */
  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputRow}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="留言..."
          className={styles.textbox}
          disabled={isSubmitting}
          rows={1}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isDisabled}
          className={styles.submitButton}
          aria-label="送出留言"
        >
          送出
        </button>
      </div>
      {content.length > 450 && (
        <span className={`${styles.charCount} ${content.length > 500 ? styles.charCountOver : ''}`}>
          {content.length}/500
        </span>
      )}
    </div>
  );
}
