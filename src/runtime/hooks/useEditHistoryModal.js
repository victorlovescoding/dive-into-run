'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * @typedef {object} UseEditHistoryModalOptions
 * @property {(target: object) => Promise<Array<object>>} loadHistory - 載入目標資源歷史記錄。
 * @property {string} [loadErrorMessage] - 載入失敗時保留在 modal 中的錯誤訊息。
 */

/**
 * 管理通用編輯歷史 modal 的開啟、載入、錯誤與重置狀態。
 * @param {UseEditHistoryModalOptions} options - hook options。
 * @returns {{
 *   historyTarget: object | null,
 *   historyEntries: Array<object>,
 *   historyError: string | null,
 *   isHistoryOpen: boolean,
 *   handleViewHistory: (target: object) => Promise<void>,
 *   handleCloseHistory: () => void,
 *   resetHistory: () => void,
 * }} 編輯歷史 modal 狀態與操作。
 */
export default function useEditHistoryModal({
  loadHistory,
  loadErrorMessage = '載入編輯記錄失敗',
}) {
  const [historyTarget, setHistoryTarget] = useState(/** @type {object | null} */ (null));
  const [historyEntries, setHistoryEntries] = useState(/** @type {Array<object>} */ ([]));
  const [historyError, setHistoryError] = useState(/** @type {string | null} */ (null));
  const requestSeqRef = useRef(0);

  const resetHistory = useCallback(() => {
    requestSeqRef.current += 1;
    setHistoryTarget(null);
    setHistoryEntries([]);
    setHistoryError(null);
  }, []);

  const handleViewHistory = useCallback(
    async (target) => {
      requestSeqRef.current += 1;
      const requestSeq = requestSeqRef.current;

      setHistoryTarget(target);
      setHistoryEntries([]);
      setHistoryError(null);

      try {
        const entries = await loadHistory(target);
        if (requestSeqRef.current !== requestSeq) return;
        setHistoryEntries(Array.isArray(entries) ? entries : []);
      } catch {
        if (requestSeqRef.current !== requestSeq) return;
        setHistoryEntries([]);
        setHistoryError(loadErrorMessage);
      }
    },
    [loadHistory, loadErrorMessage],
  );

  return {
    historyTarget,
    historyEntries,
    historyError,
    isHistoryOpen: historyTarget !== null,
    handleViewHistory,
    handleCloseHistory: resetHistory,
    resetHistory,
  };
}
