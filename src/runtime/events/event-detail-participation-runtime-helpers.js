/**
 * 綁定 participants overlay 的 backdrop click 與 Escape listeners。
 * @param {HTMLDivElement | null} overlay - overlay DOM 節點。
 * @param {() => void} handleCloseParticipants - 關閉 overlay 的 handler。
 * @returns {() => void} cleanup function。
 */
export default function bindParticipantsOverlayListeners(overlay, handleCloseParticipants) {
  /**
   * participants overlay backdrop click handler。
   * @param {MouseEvent} eventObject - 原生滑鼠事件。
   */
  function handleClick(eventObject) {
    if (eventObject.target === overlay) {
      handleCloseParticipants();
    }
  }

  /**
   * participants overlay escape handler。
   * @param {KeyboardEvent} eventObject - 原生鍵盤事件。
   */
  function handleKeyDown(eventObject) {
    if (eventObject.key === 'Escape') {
      handleCloseParticipants();
    }
  }

  overlay?.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleKeyDown);

  return () => {
    overlay?.removeEventListener('click', handleClick);
    document.removeEventListener('keydown', handleKeyDown);
  };
}
