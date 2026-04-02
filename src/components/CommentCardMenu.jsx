'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './CommentCardMenu.module.css';

/**
 * 留言卡片三點選單。
 * @param {object} props - 元件 props。
 * @param {() => void} props.onEdit - 點擊「編輯留言」回呼。
 * @param {() => void} props.onDelete - 點擊「刪除留言」回呼。
 * @returns {import('react').ReactElement} 三點選單元件。
 */
export default function CommentCardMenu({ onEdit, onDelete }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const triggerRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const itemsRef = useRef(/** @type {HTMLButtonElement[]} */ ([]));

  useEffect(() => {
    if (!isOpen) return undefined;

    /**
     * 處理選單外部點擊，關閉下拉選單。
     * @param {MouseEvent} e - 滑鼠事件。
     */
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(/** @type {Node} */ (e.target))) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus first menu item when dropdown opens
  useEffect(() => {
    if (isOpen && itemsRef.current[0]) {
      itemsRef.current[0].focus();
    }
  }, [isOpen]);

  /**
   * 處理選單鍵盤導航（Arrow Up/Down, Home, End, Escape）。
   * @param {import('react').KeyboardEvent} e - 鍵盤事件。
   */
  const handleMenuKeyDown = useCallback((e) => {
    const items = itemsRef.current;
    const currentIndex = items.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        items[next]?.focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        items[prev]?.focus();
        break;
      }
      case 'Home':
        e.preventDefault();
        items[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        items[items.length - 1]?.focus();
        break;
      case 'Escape':
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      default:
        break;
    }
  }, []);

  /**
   * 處理點擊「編輯留言」。
   */
  function handleEdit() {
    setIsOpen(false);
    onEdit();
  }

  /**
   * 處理點擊「刪除留言」。
   */
  function handleDelete() {
    setIsOpen(false);
    onDelete();
  }

  return (
    <div ref={menuRef} className={styles.wrapper}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label="更多操作"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        ⋯
      </button>
      {isOpen && (
        <div className={styles.dropdown} role="menu" tabIndex={-1} onKeyDown={handleMenuKeyDown}>
          <button
            ref={(el) => {
              itemsRef.current[0] = /** @type {HTMLButtonElement} */ (el);
            }}
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={handleEdit}
            tabIndex={0}
          >
            編輯留言
          </button>
          <button
            ref={(el) => {
              itemsRef.current[1] = /** @type {HTMLButtonElement} */ (el);
            }}
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={handleDelete}
            tabIndex={-1}
          >
            刪除留言
          </button>
        </div>
      )}
    </div>
  );
}
