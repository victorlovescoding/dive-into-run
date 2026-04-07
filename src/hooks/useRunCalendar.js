'use client';

import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { getStravaActivitiesByMonth } from '@/lib/firebase-strava';
import { groupActivitiesByDay, calcMonthSummary } from '@/lib/strava-helpers';

/** @type {import('@/lib/strava-helpers').MonthSummary} */
const EMPTY_SUMMARY = { totalMeters: 0, byType: [] };

/**
 * @typedef {object} UseRunCalendarResult
 * @property {Map<number, import('@/lib/strava-helpers').DayActivities>} dayMap - 以日期數字為 key 的每日聚合資料。
 * @property {import('@/lib/strava-helpers').MonthSummary} monthSummary - 當月總結。
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
    /** @type {Map<number, import('@/lib/strava-helpers').DayActivities>} */ (new Map()),
  );
  const [monthSummary, setMonthSummary] = useState(
    /** @type {import('@/lib/strava-helpers').MonthSummary} */ (EMPTY_SUMMARY),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(/** @type {string|null} */ (null));

  const { user } = useContext(AuthContext);

  useEffect(() => {
    if (!user) {
      setDayMap(new Map());
      setMonthSummary(EMPTY_SUMMARY);
      setIsLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getStravaActivitiesByMonth(user.uid, year, month)
      .then((activities) => {
        if (cancelled) return;
        const map = groupActivitiesByDay(activities);
        const summary = calcMonthSummary(map);
        setDayMap(map);
        setMonthSummary(summary);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || '月曆資料載入失敗');
        setIsLoading(false);
        // dayMap 和 monthSummary 保留前次有效值，不清空
      });

    return () => {
      cancelled = true;
    };
  }, [user, year, month]);

  return { dayMap, monthSummary, isLoading, error };
}
