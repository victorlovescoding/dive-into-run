/**
 * 戶外跑步圖示（跑者剪影）。
 * @param {object} props
 * @param {number} [props.size=16] - 圖示尺寸（寬高相同）。
 * @param {string} [props.className] - 額外 CSS class。
 * @returns {import('react').ReactElement} SVG 圖示。
 */
export default function RunOutdoorIcon({ size = 16, className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="14" cy="3.5" r="2" />
      <path d="M10.5 7.2 8.1 12l3.4 3.1-1.8 6.9h2.2l1.4-5.4 2.7 2.4V24h2v-6.8l-3-2.7 1-3.5c1.2 1.3 3 2.2 5 2.5v-2c-1.7-.3-3.1-1.2-3.9-2.4l-1.4-2.3c-.5-.8-1.4-1.3-2.4-1.3-.4 0-.8.1-1.1.3L8.2 8.2 5 9.7v4.3h2V11l2-1 .5-2.8Z" />
    </svg>
  );
}
