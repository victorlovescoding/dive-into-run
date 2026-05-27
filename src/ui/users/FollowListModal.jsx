'use client';

import { useEffect, useId, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './ProfileScreen.module.css';

const DEFAULT_AVATAR = '/default-avatar.png';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * @typedef {import('@/service/follow-service').FollowListRow} FollowListRow
 */

/**
 * Resolves a modal avatar URL.
 * @param {string} [photoURL] - User avatar URL.
 * @returns {string} Image source.
 */
function resolveAvatarSrc(photoURL) {
  return typeof photoURL === 'string' && photoURL.trim() ? photoURL : DEFAULT_AVATAR;
}

/**
 * Returns focusable elements inside a dialog.
 * @param {HTMLElement | null} root - Dialog root.
 * @returns {HTMLElement[]} Focusable descendants.
 */
function getFocusableElements(root) {
  if (!root) return [];

  /** @type {HTMLElement[]} */
  const elements = [];
  root.querySelectorAll(FOCUSABLE_SELECTOR).forEach((element) => {
    if (element instanceof HTMLElement && element.offsetParent !== null) {
      elements.push(element);
    }
  });
  return elements;
}

/**
 * Restores focus to an element if it is still mounted.
 * @param {Element | null} element - Previously active element.
 * @returns {void}
 */
function restoreFocus(element) {
  if (element instanceof HTMLElement && document.contains(element)) {
    element.focus();
  }
}

/**
 * Handles Tab wrapping inside a mounted dialog.
 * @param {KeyboardEvent} event - Native keydown event.
 * @param {HTMLElement | null} dialog - Dialog root.
 * @returns {void}
 */
function trapTabFocus(event, dialog) {
  const focusableElements = getFocusableElements(dialog);
  if (focusableElements.length === 0) {
    event.preventDefault();
    dialog?.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  if (!dialog?.contains(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? lastElement : firstElement).focus();
    return;
  }

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

/**
 * Follower/following list modal.
 * @param {object} props - Modal props.
 * @param {boolean} props.isOpen - Whether modal is open.
 * @param {string} props.title - Modal title.
 * @param {FollowListRow[]} props.rows - List rows.
 * @param {boolean} props.loading - Initial loading state.
 * @param {boolean} props.loadingMore - Pagination loading state.
 * @param {string | null} props.error - Error text.
 * @param {boolean} props.hasMore - Whether more rows exist.
 * @param {string} props.emptyText - Empty state text.
 * @param {() => void} props.onClose - Close handler.
 * @param {() => void} props.onRetry - Retry handler.
 * @param {() => void} props.onLoadMore - Load more handler.
 * @returns {import('react').ReactElement | null} Modal element.
 */
export default function FollowListModal({
  isOpen,
  title,
  rows,
  loading,
  loadingMore,
  error,
  hasMore,
  emptyText,
  onClose,
  onRetry,
  onLoadMore,
}) {
  const titleId = useId();
  const dialogRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const closeButtonRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const previousActiveElementRef = useRef(/** @type {Element | null} */ (null));

  useEffect(() => {
    if (!isOpen) return undefined;

    previousActiveElementRef.current = document.activeElement;
    closeButtonRef.current?.focus();

    return () => {
      restoreFocus(previousActiveElementRef.current);
      previousActiveElementRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    /**
     * Handles document-level modal keyboard controls while the modal is open.
     * @param {KeyboardEvent} event - Native keydown event.
     * @returns {void}
     */
    function handleDocumentKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        trapTabFocus(event, dialogRef.current);
      }
    }

    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.followOverlay}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.followModalCard}
        tabIndex={-1}
      >
        <div className={styles.followModalHeader}>
          <h2 id={titleId} className={styles.followModalTitle}>
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.modalCloseButton}
            onClick={onClose}
          >
            關閉
          </button>
        </div>

        <div className={styles.followModalBody}>
          {loading && (
            <div className={styles.modalStatus} role="status" aria-live="polite">
              正在載入名單...
            </div>
          )}

          {error && (
            <div className={styles.modalError} role="alert">
              <span>{error}</span>
              <button type="button" className={styles.modalRetryButton} onClick={onRetry}>
                重試
              </button>
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className={styles.modalEmpty}>{emptyText}</div>
          )}

          {rows.length > 0 && (
            <div className={styles.followRows}>
              {rows.map((row) => (
                <Link key={row.uid} href={`/users/${row.uid}`} className={styles.followRow}>
                  <Image
                    src={resolveAvatarSrc(row.photoURL)}
                    alt={row.name}
                    width={44}
                    height={44}
                    className={styles.followAvatar}
                  />
                  <span className={styles.followRowText}>
                    <span className={styles.followRowName}>{row.name}</span>
                    {row.bio && <span className={styles.followRowBio}>{row.bio}</span>}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {hasMore && !loading && (
            <button
              type="button"
              className={styles.loadMoreButton}
              onClick={onLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? '載入中...' : '載入更多'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
