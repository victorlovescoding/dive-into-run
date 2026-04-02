'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './CommentInput.module.css';

/**
 * 浮動留言輸入框。
 * @param {object} props
 * @param {(content: string) => void} props.onSubmit - 送出留言回呼。
 * @param {boolean} props.isSubmitting - 是否送出中。
 * @param {string | null} props.submitError - 送出錯誤訊息。
 */
export default function CommentInput({ onSubmit, isSubmitting, submitError }) {
  const [content, setContent] = useState('');
  const prevSubmittingRef = useRef(false);

  // Clear input on successful submit (isSubmitting: true → false, no error)
  useEffect(() => {
    if (prevSubmittingRef.current && !isSubmitting && !submitError) {
      setContent('');
    }
    prevSubmittingRef.current = isSubmitting;
  }, [isSubmitting, submitError]);

  const trimmed = content.trim();
  const isDisabled = trimmed === '' || content.length > 500 || isSubmitting;

  function handleSubmit() {
    if (!isDisabled) {
      onSubmit(content);
    }
  }

  /** @param {import('react').KeyboardEvent} e */
  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputRow}>
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="留言..."
          className={styles.textbox}
          disabled={isSubmitting}
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
