'use client';

import { useCallback, useMemo, useState } from 'react';
import { countTotalPoints } from '@/runtime/events/event-runtime-helpers';
import { listTaiwanDistricts } from '@/service/taiwan-location-service';

/**
 * @typedef {object} RoutePoint
 * @property {number} lat - 緯度。
 * @property {number} lng - 經度。
 */

/**
 * @typedef {object} DraftFormData
 * @property {string} [city] - 草稿城市。
 * @property {string} [district] - 草稿區域。
 * @property {string} [planRoute] - 是否規劃路線。
 * @property {RoutePoint[][] | null} [routeCoordinates] - 草稿路線。
 */

/**
 * @typedef {object} ToggleCreateRunFormOptions
 * @property {DraftFormData | null} draftFormData - 建立活動草稿。
 * @property {string | undefined} userUid - 目前使用者 UID。
 */

/**
 * 產生符合 `datetime-local` 的目前分鐘字串。
 * @returns {string} `YYYY-MM-DDTHH:mm` 格式的字串。
 */
function createCurrentMinuteValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * 管理 events page 建立活動表單的本地 UI 狀態。
 * @param {{ showToast: (message: string, type?: string) => void }} params - create form 依賴。
 * @returns {object} create form state 與 handlers。
 */
export default function useEventsPageCreateFormState({ showToast }) {
  const [isFormOpen, setFormOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState(
    /** @type {RoutePoint[][] | null} */ (null),
  );
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [minDateTime, setMinDateTime] = useState('');

  const selectedDistrictOptions = useMemo(() => listTaiwanDistricts(selectedCity), [selectedCity]);
  const routePointCount = useMemo(
    () => (Array.isArray(routeCoordinates) ? countTotalPoints(routeCoordinates) : 0),
    [routeCoordinates],
  );

  const resetCreateForm = useCallback(() => {
    setFormOpen(false);
    setShowMap(false);
    setRouteCoordinates(null);
    setSelectedCity('');
    setSelectedDistrict('');
  }, []);

  const handleCloseCreateForm = useCallback(() => {
    setFormOpen(false);
  }, []);

  const handleSelectedCityChange = useCallback(
    /**
     * @param {string} value - 新選取的城市。
     */
    (value) => {
      setSelectedCity(value);
      setSelectedDistrict('');
    },
    [],
  );

  const handleEnableRoutePlanning = useCallback(() => {
    setShowMap(true);
  }, []);

  const handleDisableRoutePlanning = useCallback(() => {
    setShowMap(false);
    setRouteCoordinates(null);
  }, []);

  const handleToggleCreateRunForm = useCallback(
    /**
     * @param {ToggleCreateRunFormOptions} options - 切換建立活動表單所需資料。
     */
    ({ draftFormData, userUid }) => {
      if (!userUid) {
        showToast('發起活動前請先登入', 'error');
        return;
      }

      if (isFormOpen) {
        setFormOpen(false);
        return;
      }

      setMinDateTime(createCurrentMinuteValue());

      if (draftFormData) {
        setSelectedCity(draftFormData.city || '');
        setSelectedDistrict(draftFormData.district || '');

        if (draftFormData.planRoute === 'yes') {
          setShowMap(true);
          setRouteCoordinates(draftFormData.routeCoordinates || null);
        } else {
          setShowMap(false);
          setRouteCoordinates(null);
        }
      } else {
        setSelectedCity('');
        setSelectedDistrict('');
        setShowMap(false);
        setRouteCoordinates(null);
      }

      setFormOpen(true);
    },
    [isFormOpen, showToast],
  );

  return {
    isFormOpen,
    showMap,
    routeCoordinates,
    routePointCount,
    selectedCity,
    selectedDistrict,
    selectedDistrictOptions,
    minDateTime,
    setSelectedDistrict,
    setRouteCoordinates,
    resetCreateForm,
    handleCloseCreateForm,
    handleSelectedCityChange,
    handleEnableRoutePlanning,
    handleDisableRoutePlanning,
    handleToggleCreateRunForm,
  };
}
