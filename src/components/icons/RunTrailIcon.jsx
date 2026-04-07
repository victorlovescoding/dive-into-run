/**
 * 越野跑圖示（人在山林中跑步）。
 * @param {object} props
 * @param {number} [props.size=16] - 圖示尺寸（寬高相同）。
 * @param {string} [props.className] - 額外 CSS class。
 * @returns {import('react').ReactElement} SVG 圖示。
 */
export default function RunTrailIcon({ size = 16, className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* 山峰（背景三座山） */}
      <polyline points="1,20 5,12 9,20" />
      <polyline points="7,20 12,8 17,20" />
      <polyline points="15,20 19,13 23,20" />
      {/* 簡易樹 */}
      <line x1="4" y1="14" x2="4" y2="11" />
      <polyline points="2.5,12 4,9.5 5.5,12" />
      {/* 跑者剪影 */}
      {/* 頭 */}
      <circle cx="17" cy="5" r="1.2" fill="currentColor" stroke="none" />
      {/* 身體 */}
      <line x1="16.5" y1="6.2" x2="15.5" y2="10" />
      {/* 前手 */}
      <line x1="16" y1="7.5" x2="18" y2="8.5" />
      {/* 後手 */}
      <line x1="16" y1="7.5" x2="14" y2="7" />
      {/* 前腿 */}
      <polyline points="15.5,10 17,12 18,14" />
      {/* 後腿 */}
      <polyline points="15.5,10 14,12.5 13,14" />
      {/* 地面線 */}
      <line x1="1" y1="20" x2="23" y2="20" />
    </svg>
  );
}
