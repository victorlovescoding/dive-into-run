'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './CommentCardMenu.module.css';

/**
 * 留言卡片三點選單。
 * @param {object} props
 * @param {() => void} props.onEdit - 點擊「編輯留言」回呼。
 * @param {() => void} props.onDelete - 點擊「刪除留言」回呼。
 */
export default function CommentCardMenu({ onEdit, onDelete }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(/** @type {HTMLDivElement | null} */ (null));

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
        type="button"
        className={styles.trigger}
        aria-label="更多操作"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        ⋯
      </button>
      {isOpen && (
        <div className={styles.dropdown} role="menu">
          <button type="button" role="menuitem" className={styles.menuItem} onClick={handleEdit}>
            編輯留言
          </button>
          <button type="button" role="menuitem" className={styles.menuItem} onClick={handleDelete}>
            刪除留言
          </button>
        </div>
      )}
    </div>
  );
}
