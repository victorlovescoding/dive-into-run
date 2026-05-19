import styles from './BookmarkButton.module.css';

/**
 * @typedef {object} BookmarkButtonProps
 * @property {boolean} isActive - 目前是否已收藏。
 * @property {() => void} [onClick] - 點擊收藏按鈕時執行的回呼。
 * @property {string} label - 未收藏狀態的無障礙標籤。
 * @property {string} activeLabel - 已收藏狀態的無障礙標籤。
 * @property {boolean} [disabled] - 是否停用按鈕。
 * @property {string} [className] - 外部版位需要附加的 className。
 */

/**
 * Shared bookmark toggle button for post and event surfaces.
 * @param {BookmarkButtonProps} props - Bookmark button props.
 * @returns {import('react').ReactElement} Native bookmark button.
 */
export default function BookmarkButton({
  isActive,
  onClick,
  label,
  activeLabel,
  disabled = false,
  className,
}) {
  const buttonLabel = isActive ? activeLabel : label;
  const buttonClassName = className ? `${styles.button} ${className}` : styles.button;
  const iconFill = isActive ? 'currentColor' : 'none';

  return (
    <button
      type="button"
      className={buttonClassName}
      aria-label={buttonLabel}
      aria-pressed={isActive}
      disabled={disabled}
      onClick={onClick}
    >
      <svg
        className={styles.icon}
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill={iconFill}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        data-testid="bookmark-icon"
      >
        <path d="M6 3.75h12a1 1 0 0 1 1 1v15.5l-7-4-7 4V4.75a1 1 0 0 1 1-1z" />
      </svg>
    </button>
  );
}
