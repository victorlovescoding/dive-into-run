'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { listTaiwanCities, listTaiwanDistricts } from '@/service/taiwan-location-service';
import { queryEvents } from '@/runtime/client/use-cases/event-use-cases';

/**
 * @typedef {import('react').MutableRefObject<boolean>} MountedRef
 */

/**
 * @typedef {object} UseEventsFilterParams
 * @property {boolean} isFormOpen - 建立表單是否開啟（過濾器不可同時開啟）。
 * @property {MountedRef} isMountedRef - 元件是否已掛載的 ref。
 * @property {(updater: import('@/service/event-service').EventData[] | ((previous: import('@/service/event-service').EventData[]) => import('@/service/event-service').EventData[])) => void} setEvents - 設定活動列表的 setter。
 * @property {(cursor: unknown) => void} setCursor - 設定分頁游標的 setter。
 * @property {(error: string | null) => void} setLoadError - 設定載入錯誤訊息的 setter。
 * @property {(error: string | null) => void} setLoadMoreError - 設定載入更多錯誤訊息的 setter。
 * @property {(hasMore: boolean) => void} setHasMore - 設定是否有更多資料的 setter。
 * @property {(options?: { replaceExisting?: boolean }) => Promise<void>} loadLatestPage - 載入最新一頁活動的函式。
 */

/**
 * @typedef {object} UseEventsFilterReturn
 * @property {boolean} isFilterOpen - 篩選面板是否開啟。
 * @property {string} filterTimeStart - 篩選起始時間。
 * @property {string} filterTimeEnd - 篩選結束時間。
 * @property {string} filterDistanceMin - 篩選最小距離。
 * @property {string} filterDistanceMax - 篩選最大距離。
 * @property {boolean} filterHasSeatsOnly - 是否只顯示有空位的活動。
 * @property {string} filterCity - 篩選縣市。
 * @property {string} filterDistrict - 篩選區域。
 * @property {boolean} isFilteredResults - 目前列表是否為篩選結果。
 * @property {boolean} isFiltering - 是否正在篩選中。
 * @property {string[]} cityOptions - 可選縣市列表。
 * @property {string[]} filterDistrictOptions - 依篩選縣市對應的區域列表。
 * @property {(value: string) => void} setFilterTimeStart - 設定篩選起始時間。
 * @property {(value: string) => void} setFilterTimeEnd - 設定篩選結束時間。
 * @property {(value: string) => void} setFilterDistanceMin - 設定篩選最小距離。
 * @property {(value: string) => void} setFilterDistanceMax - 設定篩選最大距離。
 * @property {(value: boolean) => void} setFilterHasSeatsOnly - 設定是否只顯示有空位。
 * @property {(value: string) => void} setFilterDistrict - 設定篩選區域。
 * @property {(value: string) => void} handleFilterCityChange - 變更篩選縣市（會連帶清空區域）。
 * @property {() => void} handleOpenFilter - 開啟篩選面板。
 * @property {() => void} handleCloseFilter - 關閉篩選面板。
 * @property {() => Promise<void>} handleClearFilters - 清除所有篩選條件並重新載入。
 * @property {() => Promise<void>} handleSearchFilters - 執行篩選搜尋。
 */

/**
 * 管理活動列表的篩選狀態與操作。
 * @param {UseEventsFilterParams} params - 來自父層 hook 的依賴。
 * @returns {UseEventsFilterReturn} 篩選相關的狀態與 handler。
 */
export default function useEventsFilter({
  isFormOpen,
  isMountedRef,
  setEvents,
  setCursor,
  setLoadError,
  setLoadMoreError,
  setHasMore,
  loadLatestPage,
}) {
  const [isFilterOpen, setFilterOpen] = useState(false);
  const [filterTimeStart, setFilterTimeStart] = useState('');
  const [filterTimeEnd, setFilterTimeEnd] = useState('');
  const [filterDistanceMin, setFilterDistanceMin] = useState('');
  const [filterDistanceMax, setFilterDistanceMax] = useState('');
  const [filterHasSeatsOnly, setFilterHasSeatsOnly] = useState(false);
  const [filterCity, setFilterCity] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [isFilteredResults, setIsFilteredResults] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);

  const cityOptions = useMemo(() => listTaiwanCities(), []);
  const filterDistrictOptions = useMemo(() => listTaiwanDistricts(filterCity), [filterCity]);

  useEffect(() => {
    if (!isFilterOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFilterOpen]);

  const handleOpenFilter = useCallback(() => {
    if (isFormOpen) return;
    setFilterOpen(true);
  }, [isFormOpen]);

  const handleCloseFilter = useCallback(() => {
    setFilterOpen(false);
  }, []);

  const handleFilterCityChange = useCallback(
    /** @param {string} value - 選取的縣市值。 */
    (value) => {
      setFilterCity(value);
      setFilterDistrict('');
    },
    [],
  );

  const handleClearFilters = useCallback(async () => {
    setFilterTimeStart('');
    setFilterTimeEnd('');
    setFilterDistanceMin('');
    setFilterDistanceMax('');
    setFilterHasSeatsOnly(false);
    setFilterCity('');
    setFilterDistrict('');
    setIsFilteredResults(false);
    await loadLatestPage({ replaceExisting: true });
  }, [loadLatestPage]);

  const handleSearchFilters = useCallback(async () => {
    setFilterOpen(false);
    setIsFiltering(true);
    setLoadError(null);

    const filters = {
      city: filterCity,
      district: filterDistrict,
      startTime: filterTimeStart,
      endTime: filterTimeEnd,
      minDistance: filterDistanceMin,
      maxDistance: filterDistanceMax,
      hasSeatsOnly: filterHasSeatsOnly,
    };

    try {
      const results = await queryEvents(filters);
      if (!isMountedRef.current) return;
      setEvents(results);
      setCursor(null);
      setLoadMoreError(null);
      setIsFilteredResults(true);
      setHasMore(false);
    } catch (error) {
      console.error('篩選失敗:', error);
      if (!isMountedRef.current) return;
      setLoadError('搜尋失敗，請稍後再試');
    } finally {
      if (isMountedRef.current) {
        setIsFiltering(false);
      }
    }
  }, [
    filterCity,
    filterDistrict,
    filterDistanceMax,
    filterDistanceMin,
    filterHasSeatsOnly,
    filterTimeEnd,
    filterTimeStart,
    isMountedRef,
    setCursor,
    setEvents,
    setHasMore,
    setLoadError,
    setLoadMoreError,
  ]);

  return {
    isFilterOpen,
    filterTimeStart,
    filterTimeEnd,
    filterDistanceMin,
    filterDistanceMax,
    filterHasSeatsOnly,
    filterCity,
    filterDistrict,
    isFilteredResults,
    isFiltering,
    cityOptions,
    filterDistrictOptions,
    setFilterTimeStart,
    setFilterTimeEnd,
    setFilterDistanceMin,
    setFilterDistanceMax,
    setFilterHasSeatsOnly,
    setFilterDistrict,
    handleFilterCityChange,
    handleOpenFilter,
    handleCloseFilter,
    handleClearFilters,
    handleSearchFilters,
  };
}
