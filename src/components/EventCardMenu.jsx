'use client';

import { useState, useRef, useEffect } from 'react';
import menuStyles from './EventCardMenu.module.css';

/**
 * @typedef {import('@/lib/event-helpers').EventData} EventData
 */

/**
 * @typedef {object} EventCardMenuProps
 * @property {EventData} event - 活動資料。
 * @property {string|null} currentUserUid - 目前登入使用者的 UID，未登入為 null。
 * @property {(ev: EventData) => void} onEdit - 點擊「編輯活動」的回呼。
 * @property {(ev: EventData) => void} onDelete - 點擊「刪除活動」的回呼。
 */

/**
 * EventCardMenu — 活動卡片右上角三點選單，僅活動創建人可見。
 * 提供「編輯活動」與「刪除活動」兩個操作選項。
 * @param {EventCardMenuProps} props - Component props.
 * @returns {import('react').ReactElement|null} 三點選單元件，非創建人時回傳 null。
 */
export default function EventCardMenu({
  event,
  currentUserUid,
  onEdit,
  onDelete,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(/** @type {HTMLDivElement|null} */ (null));

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

  if (currentUserUid !== event.hostUid) return null;

  /**
   * 處理點擊「編輯活動」。
   */
  function handleEdit() {
    setIsOpen(false);
    onEdit(event);
  }

  /**
   * 處理點擊「刪除活動」。
   */
  function handleDelete() {
    setIsOpen(false);
    onDelete(event);
  }

  return (
    <div ref={menuRef} className={menuStyles.menuRoot}>
      <button
        type="button"
        aria-label="更多操作"
        className={menuStyles.triggerButton}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        ⋯
      </button>
      {isOpen && (
        <div role="menu" className={menuStyles.dropdown}>
          <button type="button" role="menuitem" className={menuStyles.menuItem} onClick={handleEdit}>
            編輯活動
          </button>
          <button type="button" role="menuitem" className={menuStyles.menuItem} onClick={handleDelete}>
            刪除活動
          </button>
        </div>
      )}
    </div>
  );
}
