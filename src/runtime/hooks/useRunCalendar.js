'use client';

import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { getStravaActivitiesByMonth } from '@/repo/client/firebase-strava-repo';
import { calcMonthSummary, groupActivitiesByDay } from '@/service/strava-data-service';

/** @type {import('@/service/strava-data-service').MonthSummary} */
const EMPTY_SUMMARY = { totalMeters: 0, byType: [] };

/**
 * @typedef {object} UseRunCalendarResult
 * @property {Map<number, import('@/service/strava-data-service').DayActivities>} dayMap - 以日期數字為 key 的每日聚合資料。
 * @property {import('@/service/strava-data-service').MonthSummary} monthSummary - 當月總結。
 * @property {boolean} isLoading - 是否載入中。
 * @property {string|null} error - 錯誤訊息。
 */

/**
 * 取得指定月份的跑步月曆資料。
 * @param {number} year - 年份。
 * @param {number} month - 月份（0-11）。
 * @returns {UseRunCalendarResult} 月曆資料與狀態。
 */
export default function useRunCalendar(year, month) {
  const [dayMap, setDayMap] = useState(
    /** @type {Map<number, import('@/service/strava-data-service').DayActivities>} */ (new Map()),
  );
  const [monthSummary, setMonthSummary] = useState(
    /** @type {import('@/service/strava-data-service').MonthSummary} */ (EMPTY_SUMMARY),
  );
  const [error, setError] = useState(/** @type {string|null} */ (null));
  const [loaded, setLoaded] = useState(
    /** @type {{ year: number, month: number }} */ ({ year: -1, month: -1 }),
  );

  const { user } = useContext(AuthContext);

  useEffect(() => {
    if (!user) return undefined;

    let cancelled = false;

    getStravaActivitiesByMonth(user.uid, year, month)
      .then((activities) => {
        if (cancelled) return;
        const map = groupActivitiesByDay(activities);
        const summary = calcMonthSummary(map);
        setDayMap(map);
        setMonthSummary(summary);
        setError(null);
        setLoaded({ year, month });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || '月曆資料載入失敗');
        setLoaded({ year, month });
      });

    return () => {
      cancelled = true;
    };
  }, [user, year, month]);

  const isLoading = !!user && (loaded.year !== year || loaded.month !== month);

  if (!user) {
    return { dayMap: new Map(), monthSummary: EMPTY_SUMMARY, isLoading: false, error: null };
  }

  return {
    dayMap,
    monthSummary,
    isLoading,
    error: isLoading ? null : error,
  };
}
