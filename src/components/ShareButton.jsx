'use client';

import { useCallback } from 'react';
import { useToast } from '@/contexts/ToastContext';
import styles from './ShareButton.module.css';

/**
 * 執行分享動作：優先使用 Web Share API，fallback 為複製連結到剪貼簿。
 * @param {object} params - 分享參數。
 * @param {string} params.title - 分享標題。
 * @param {string} params.url - 分享網址。
 * @param {(message: string, type?: 'success' | 'error' | 'info') => void} params.showToast - Toast 通知函式。
 * @returns {Promise<void>}
 */
async function executeShare({ title, url, showToast }) {
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
    } else {
      await navigator.clipboard.writeText(url);
      showToast('已複製連結');
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }
    showToast('分享失敗', 'error');
  }
}

/**
 * 共用分享按鈕，支援 Web Share API 和 Clipboard fallback。
 * @param {object} props - 元件屬性。
 * @param {string} props.title - 分享標題。
 * @param {string} props.url - 分享網址。
 * @returns {import('react').JSX.Element} 分享按鈕元件。
 */
export default function ShareButton({ title, url }) {
  const { showToast } = useToast();

  const handleShare = useCallback(
    () => executeShare({ title, url, showToast }),
    [title, url, showToast],
  );

  return (
    <button
      type="button"
      className={styles.shareButton}
      onClick={handleShare}
      aria-label="分享"
      title="分享"
    >
      <svg className={styles.shareIcon} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
    </button>
  );
}
