/**
 * 室內跑步圖示（跑步機）。
 * @param {object} props - 元件屬性。
 * @param {number} [props.size] - 圖示尺寸（寬高相同），預設 16。
 * @param {string} [props.className] - 額外 CSS class。
 * @returns {import('react').ReactElement} SVG 圖示。
 */
export default function RunIndoorIcon({ size = 16, className }) {
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
      {/* 跑者頭部 */}
      <circle cx="14" cy="4" r="1.5" fill="currentColor" stroke="none" />
      {/* 跑者身體 */}
      <path d="M13 7l-2 4h3l-1.5 3" />
      {/* 跑者前腿 */}
      <path d="M11 11l-1.5 3.5" />
      {/* 跑者後腿 */}
      <path d="M14.5 11l1 3" />
      {/* 跑步機扶手立柱 */}
      <path d="M7 8v8" />
      {/* 跑步機面板 */}
      <rect x="5.5" y="7" width="3" height="2" rx="0.5" fill="currentColor" stroke="none" />
      {/* 跑帶平台 */}
      <path d="M5 16h14" strokeWidth={2} />
      {/* 跑步機前腳 */}
      <path d="M6 16v4" />
      {/* 跑步機後腳 */}
      <path d="M18 16v4" />
      {/* 底座 */}
      <path d="M4 20h16" strokeWidth={2} />
    </svg>
  );
}
