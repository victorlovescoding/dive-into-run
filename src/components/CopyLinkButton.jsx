'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './CopyLinkButton.module.css';

/**
 * 用 textarea fallback 同步複製文字。
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
 * 優先用 Clipboard API 複製網址，失敗時使用 textarea fallback。
 * @param {string} url - 要複製的網址。
 * @returns {Promise<boolean>} 複製成功時回傳 true。
 */
async function copyUrl(url) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    return copyViaTextarea(url);
  }
  return copyViaTextarea(url);
}

/**
 * 重疊方塊複製 icon。
 * @returns {import('react').ReactElement} SVG icon。
 */
function CopyIcon() {
  return (
    <svg className={styles.copyIcon} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/**
 * 複製成功 check icon。
 * @returns {import('react').ReactElement} SVG icon。
 */
function CheckIcon() {
  return (
    <svg className={styles.copyIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * 共用複製連結按鈕。
 * @param {object} props - 元件 props。
 * @param {string} props.url - 要複製的網址。
 * @returns {import('react').ReactElement} 複製連結按鈕。
 */
export default function CopyLinkButton({ url }) {
  const [copied, setCopied] = useState(false);
  const isMountedRef = useRef(false);
  const resetTimeoutRef = useRef(/** @type {number | null} */ (null));

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    const didCopy = await copyUrl(url);
    if (!didCopy || !isMountedRef.current) return;

    setCopied(true);
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current);
    }
    resetTimeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      resetTimeoutRef.current = null;
    }, 2000);
  }, [url]);

  const label = copied ? '已複製連結' : '複製連結';
  const icon = copied ? <CheckIcon /> : <CopyIcon />;

  return (
    <button
      type="button"
      className={`${styles.copyLinkButton}${copied ? ` ${styles.copyLinkButtonCopied}` : ''}`}
      onClick={handleCopy}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
