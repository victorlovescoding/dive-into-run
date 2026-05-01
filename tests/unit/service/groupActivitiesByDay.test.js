/**
 * @file Unit tests for groupActivitiesByDay — 將活動按日期分組並聚合距離。
 *
 * 驗證依 startDateLocal 分組、同類型距離加總、多類型獨立聚合、
 * 空陣列回傳空 Map、以及 runs 陣列按 Run > VirtualRun > TrailRun 排序。
 */
import { describe, it, expect } from 'vitest';
import { groupActivitiesByDay } from '@/service/strava-data-service';
import { createStravaFirestoreActivity as makeActivity } from '../../_helpers/strava-fixtures';

// ---------------------------------------------------------------------------
// groupActivitiesByDay
// ---------------------------------------------------------------------------
describe('Unit: groupActivitiesByDay', () => {
  // -----------------------------------------------------------------------
  // 1. 按 startDateLocal 正確分組
  // -----------------------------------------------------------------------
  it('should group activities by startDateLocal date into correct day keys', () => {
    // Arrange — two activities on day 7, one on day 10
    const activities = [
      makeActivity({ id: 'a1', startDateLocal: '2026-04-07T06:30:00Z', distanceMeters: 3000 }),
      makeActivity({ id: 'a2', startDateLocal: '2026-04-07T18:00:00Z', distanceMeters: 5000 }),
      makeActivity({ id: 'a3', startDateLocal: '2026-04-10T07:00:00Z', distanceMeters: 8000 }),
    ];

    // Act
    const result = groupActivitiesByDay(activities);

    // Assert — Map should have keys 7 and 10
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
    expect(result.has(7)).toBe(true);
    expect(result.has(10)).toBe(true);

    const day7 = result.get(7);
    expect(day7.dateKey).toBe('2026-04-07');
    expect(day7.day).toBe(7);

    const day10 = result.get(10);
    expect(day10.dateKey).toBe('2026-04-10');
    expect(day10.day).toBe(10);
  });

  // -----------------------------------------------------------------------
  // 2. 同類型距離正確加總
  // -----------------------------------------------------------------------
  it('should sum distanceMeters for same type on the same day', () => {
    // Arrange — three Run activities on 2026-04-07
    const activities = [
      makeActivity({ id: 'a1', startDateLocal: '2026-04-07T06:30:00Z', distanceMeters: 3000 }),
      makeActivity({ id: 'a2', startDateLocal: '2026-04-07T07:30:00Z', distanceMeters: 5000 }),
      makeActivity({ id: 'a3', startDateLocal: '2026-04-07T08:30:00Z', distanceMeters: 2000 }),
    ];

    // Act
    const result = groupActivitiesByDay(activities);

    // Assert
    const day7 = result.get(7);
    expect(day7.runs).toHaveLength(1);
    expect(day7.runs[0].type).toBe('Run');
    expect(day7.runs[0].totalMeters).toBe(10000);
    expect(day7.totalMeters).toBe(10000);
  });

  // -----------------------------------------------------------------------
  // 3. 同一天多類型各自獨立
  // -----------------------------------------------------------------------
  it('should keep different types separate within the same day', () => {
    // Arrange — Run + VirtualRun on same day
    const activities = [
      makeActivity({
        id: 'a1',
        type: 'Run',
        startDateLocal: '2026-04-07T06:30:00Z',
        distanceMeters: 5000,
      }),
      makeActivity({
        id: 'a2',
        type: 'VirtualRun',
        startDateLocal: '2026-04-07T07:30:00Z',
        distanceMeters: 3000,
      }),
    ];

    // Act
    const result = groupActivitiesByDay(activities);

    // Assert
    const day7 = result.get(7);
    expect(day7.runs).toHaveLength(2);

    const runEntry = day7.runs.find((r) => r.type === 'Run');
    const virtualEntry = day7.runs.find((r) => r.type === 'VirtualRun');
    expect(runEntry.totalMeters).toBe(5000);
    expect(virtualEntry.totalMeters).toBe(3000);
    expect(day7.totalMeters).toBe(8000);
  });

  // -----------------------------------------------------------------------
  // 4. 空陣列輸入 → 空 Map
  // -----------------------------------------------------------------------
  it('should return an empty Map when given an empty array', () => {
    // Arrange
    const activities = [];

    // Act
    const result = groupActivitiesByDay(activities);

    // Assert
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 5. type 排序正確（Run > VirtualRun > TrailRun）
  // -----------------------------------------------------------------------
  it('should order runs as Run > VirtualRun > TrailRun regardless of input order', () => {
    // Arrange — insert in reverse order: TrailRun, VirtualRun, Run
    const activities = [
      makeActivity({
        id: 'a1',
        type: 'TrailRun',
        startDateLocal: '2026-04-07T06:30:00Z',
        distanceMeters: 4000,
      }),
      makeActivity({
        id: 'a2',
        type: 'VirtualRun',
        startDateLocal: '2026-04-07T07:30:00Z',
        distanceMeters: 3000,
      }),
      makeActivity({
        id: 'a3',
        type: 'Run',
        startDateLocal: '2026-04-07T08:30:00Z',
        distanceMeters: 5000,
      }),
    ];

    // Act
    const result = groupActivitiesByDay(activities);

    // Assert — runs array should follow fixed order
    const day7 = result.get(7);
    expect(day7.runs).toHaveLength(3);
    expect(day7.runs[0].type).toBe('Run');
    expect(day7.runs[1].type).toBe('VirtualRun');
    expect(day7.runs[2].type).toBe('TrailRun');
  });
});
