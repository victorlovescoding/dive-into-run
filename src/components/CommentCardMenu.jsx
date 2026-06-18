'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './CommentCardMenu.module.css';

/**
 * 留言卡片三點選單。
 * @param {object} props - 元件 props。
 * @param {() => void} [props.onEdit] - 點擊「編輯留言」回呼。
 * @param {() => void} [props.onDelete] - 點擊「刪除留言」回呼。
 * @param {() => void} [props.onReport] - 點擊「檢舉留言」回呼。
 * @returns {import('react').ReactElement} 三點選單元件。
 */
export default function CommentCardMenu({ onEdit, onDelete, onReport }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const triggerRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const itemsRef = useRef(/** @type {HTMLButtonElement[]} */ ([]));
  const menuItems = [
    onEdit && { key: 'edit', label: '編輯留言', action: onEdit },
    onDelete && { key: 'delete', label: '刪除留言', action: onDelete },
    onReport && { key: 'report', label: '檢舉留言', action: onReport },
  ].filter(Boolean);

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

  if (menuItems.length === 0) {
    return null;
  }

  /**
   * 關閉選單並執行指定操作。
   * @param {() => void} action - 選單操作。
   */
  function handleMenuItem(action) {
    setIsOpen(false);
    action();
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
          {menuItems.map((item, index) => (
            <button
              key={item.key}
              ref={(el) => {
                if (el) {
                  itemsRef.current[index] = el;
                }
              }}
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={() => handleMenuItem(item.action)}
              tabIndex={index === 0 ? 0 : -1}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
