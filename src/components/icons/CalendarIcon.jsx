/**
 * 月曆按鈕圖示。
 * @param {object} props
 * @param {number} [props.size=16] - 圖示尺寸（寬高相同）。
 * @param {string} [props.className] - 額外 CSS class。
 * @returns {import('react').ReactElement} SVG 圖示。
 */
export default function CalendarIcon({ size = 16, className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* 日曆本體 */}
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      {/* 上方掛鉤 */}
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      {/* 標題列分隔線 */}
      <line x1="3" y1="10" x2="21" y2="10" />
      {/* 垂直網格線 */}
      <line x1="10" y1="10" x2="10" y2="22" />
      <line x1="14" y1="10" x2="14" y2="22" />
      {/* 水平網格線 */}
      <line x1="3" y1="15" x2="21" y2="15" />
    </svg>
  );
}
