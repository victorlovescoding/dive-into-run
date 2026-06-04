/**
 * Shared edited-state affordance.
 * @param {object} props - Component props。
 * @param {() => void} props.onClick - 點擊回呼。
 * @param {string} [props.className] - 外部樣式 class。
 * @param {string} [props.ariaLabel] - 無障礙標籤。
 * @returns {import('react').ReactElement} 已編輯 affordance。
 */
export default function EditedAffordance({
  onClick,
  className,
  ariaLabel = '查看編輯記錄',
}) {
  return (
    <button type="button" className={className} aria-label={ariaLabel} onClick={onClick}>
      已編輯
    </button>
  );
}
