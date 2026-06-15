'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './PostSearchForm.module.css';

const DEFAULT_PROMPT = '請輸入搜尋關鍵字';
const DEFAULT_SEARCH_ROUTE = '/posts/search';

/**
 * @typedef {object} PostSearchFormProps
 * @property {string} [initialKeyword] 初始搜尋關鍵字。
 * @property {string} [label] 搜尋區域與輸入框的 accessible label。
 * @property {string} [placeholder] 搜尋輸入框 placeholder。
 * @property {string} [submitLabel] 搜尋按鈕文字。
 * @property {string} [blankPrompt] 空白提交時顯示的提示。
 * @property {string} [searchRoute] 搜尋結果頁 route。
 */

/**
 * 可重用的文章搜尋表單。
 * @param {PostSearchFormProps} props Component props。
 * @returns {import('react').ReactElement} Search form。
 */
export default function PostSearchForm({
  initialKeyword = '',
  label = '搜尋文章',
  placeholder = '輸入關鍵字',
  submitLabel = '搜尋',
  blankPrompt = DEFAULT_PROMPT,
  searchRoute = DEFAULT_SEARCH_ROUTE,
} = {}) {
  const router = useRouter();
  const promptId = useId();
  const [keyword, setKeyword] = useState(initialKeyword);
  const [prompt, setPrompt] = useState('');

  /**
   * Handles search submission.
   * @param {import('react').FormEvent<HTMLFormElement>} event Form event。
   * @returns {void}
   */
  function handleSubmit(event) {
    event.preventDefault();

    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) {
      setPrompt(blankPrompt);
      return;
    }

    setPrompt('');
    router.push(`${searchRoute}?q=${encodeURIComponent(trimmedKeyword)}`);
  }

  /**
   * Updates keyword state and clears stale validation prompt.
   * @param {import('react').ChangeEvent<HTMLInputElement>} event Input event。
   * @returns {void}
   */
  function handleKeywordChange(event) {
    setKeyword(event.target.value);
    if (prompt) {
      setPrompt('');
    }
  }

  return (
    <form
      className={styles.searchForm}
      role="search"
      aria-label={label}
      onSubmit={handleSubmit}
      noValidate
    >
      <div className={styles.inputGroup}>
        <input
          className={styles.input}
          type="text"
          value={keyword}
          placeholder={placeholder}
          aria-label={label}
          onChange={handleKeywordChange}
          aria-invalid={prompt ? 'true' : undefined}
          aria-describedby={prompt ? promptId : undefined}
        />
      </div>
      <button className={styles.submitButton} type="submit">
        {submitLabel}
      </button>
      {prompt && (
        <p id={promptId} className={styles.prompt} role="alert">
          {prompt}
        </p>
      )}
    </form>
  );
}
