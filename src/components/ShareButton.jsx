'use client';

import { useCallback } from 'react';
import { useToast } from '@/contexts/ToastContext';
import styles from './ShareButton.module.css';

/**
 * 同步複製文字到剪貼簿的最後手段：用隱藏 textarea + `execCommand('copy')`。
 * 在 non-secure context（例：HTTP LAN IP）或 Clipboard API 被瀏覽器拒絕時使用。
 * @param {string} text - 要複製的文字。
 * @returns {boolean} 複製是否成功。
 */
function copyViaTextarea(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  try {
    textarea.select();
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Clipboard API fallback for non-secure contexts
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

/**
 * 嘗試複製 URL 到剪貼簿：優先用 Clipboard API，失敗則 fallback 到 `execCommand`。
 * @param {string} text - 要複製的文字。
 * @returns {Promise<boolean>} 是否成功複製。
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API 不存在或被瀏覽器拒絕（例：Firefox non-secure context）
    return copyViaTextarea(text);
  }
}

/**
 * 執行分享動作，依序嘗試三種方式：
 * 1. 觸控裝置（`pointer: coarse`）+ 支援 Web Share API → 系統原生分享面板
 * 2. Clipboard API → 複製連結 + toast
 * 3. `execCommand('copy')` fallback → 複製連結 + toast（non-secure context）
 * @param {object} params - 分享參數。
 * @param {string} params.title - 分享標題。
 * @param {string} params.url - 分享網址。
 * @param {(message: string, type?: 'success' | 'error' | 'info') => void} params.showToast - Toast 通知函式。
 * @returns {Promise<void>}
 */
async function executeShare({ title, url, showToast }) {
  try {
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ title, url });
      return;
    }
    if (!(await copyToClipboard(url))) {
      showToast('分享失敗', 'error');
      return;
    }
    showToast('已複製連結');
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
