'use client';

import { REPORT_TARGET_TYPES } from '@/constants/report-constants';

const PHASE_ONE_TARGET_METADATA = Object.freeze({
  [REPORT_TARGET_TYPES.POST]: Object.freeze({
    menuLabel: '檢舉文章',
    dialogTitle: '檢舉這篇文章',
    previewLabel: '文章預覽',
  }),
  [REPORT_TARGET_TYPES.POST_COMMENT]: Object.freeze({
    menuLabel: '檢舉留言',
    dialogTitle: '檢舉這則留言',
    previewLabel: '留言預覽',
  }),
});

/**
 * Returns Phase 1 report UI labels for a target type.
 * @param {string} targetType - Report target type.
 * @returns {{ menuLabel: string, dialogTitle: string, previewLabel: string } | null}
 *   Metadata for supported Phase 1 UI targets.
 */
export function getReportTargetMetadata(targetType) {
  return PHASE_ONE_TARGET_METADATA[targetType] ?? null;
}

/**
 * Reusable report action for menu surfaces.
 * @param {object} props - Component props.
 * @param {string} props.targetType - Report target type.
 * @param {() => void} props.onSelect - Report action callback.
 * @param {string} [props.className] - Optional menu item class.
 * @returns {import('react').ReactElement | null} Report menu item.
 */
export default function ReportMenuItem({ targetType, onSelect, className = '' }) {
  const metadata = getReportTargetMetadata(targetType);
  if (!metadata) return null;

  return (
    <button type="button" role="menuitem" className={className} onClick={() => onSelect()}>
      {metadata.menuLabel}
    </button>
  );
}
