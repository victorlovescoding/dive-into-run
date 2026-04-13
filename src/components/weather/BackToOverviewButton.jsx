import styles from './weather.module.css';

/**
 * 回到全台總覽按鈕 — 顯示台灣輪廓 SVG + 文字。
 * @param {object} props - 元件屬性。
 * @param {() => void} props.onClick - 點擊回呼。
 * @returns {import('react').JSX.Element} 按鈕元件。
 */
export default function BackToOverviewButton({ onClick }) {
  return (
    <button type="button" className={styles.backButton} onClick={onClick}>
      <svg
        className={styles.backButtonIcon}
        viewBox="0 0 24 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Simplified Taiwan outline */}
        <path
          d="M12 2 C8 4 6 8 5 12 C4 16 5 20 6 24 C7 26 9 28 12 30 C15 28 17 26 18 24 C19 20 20 16 19 12 C18 8 16 4 12 2Z"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
      <span>全台總覽</span>
    </button>
  );
}
