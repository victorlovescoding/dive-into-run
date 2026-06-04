'use client';

import styles from './CommentInput.module.css';
import useCommentComposerInput from './useCommentComposerInput';

/**
 * 浮動留言輸入框。
 * @param {object} props - 元件 props。
 * @param {(content: string) => boolean | Promise<boolean>} props.onSubmit - 送出留言回呼，成功回傳 true。
 * @param {boolean} props.isSubmitting - 是否送出中。
 * @returns {import('react').ReactElement} 留言輸入框元件。
 */
export default function CommentInput({ onSubmit, isSubmitting }) {
  const {
    content,
    setContent,
    isDisabled,
    textboxRef,
    handleSubmit,
    handleKeyDown,
  } = useCommentComposerInput({ onSubmit, isSubmitting });

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputRow}>
        <input
          ref={textboxRef}
          type="text"
          aria-label="留言"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="留言"
          className={styles.textbox}
          disabled={isSubmitting}
        />
        <button
          type="button"
          onClick={() => {
            handleSubmit();
          }}
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
