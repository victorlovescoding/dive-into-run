/**
 * @file Unit tests for calcMonthSummary — 計算月份跑步摘要。
 *
 * 驗證總距離加總、各類型小計、零紀錄類型排除、空 Map 處理，
 * 以及 RUN_TYPE_LABELS 標籤映射正確性。
 */
import { describe, it, expect } from 'vitest';
import { calcMonthSummary, RUN_TYPE_LABELS } from '@/lib/strava-helpers';

// ---------------------------------------------------------------------------
// helpers — 建立測試用 DayActivities
// ---------------------------------------------------------------------------

/**
 * 建立一筆 DayActivities 測試資料。
 * @param {number} day - 日期（1-31）。
 * @param {Array<{ type: string, totalMeters: number }>} runs - 當日跑步紀錄。
 * @returns {{ dateKey: string, day: number, runs: Array<{ type: string, totalMeters: number }>, totalMeters: number }}
 */
function makeDayActivities(day, runs) {
  const totalMeters = runs.reduce((sum, r) => sum + r.totalMeters, 0);
  return {
    dateKey: `2025-04-${String(day).padStart(2, '0')}`,
    day,
    runs,
    totalMeters,
  };
}

// ---------------------------------------------------------------------------
// calcMonthSummary
// ---------------------------------------------------------------------------
describe('Unit: calcMonthSummary', () => {
  // -----------------------------------------------------------------------
  // 1. 總距離正確計算
  // -----------------------------------------------------------------------
  it('should sum totalMeters across all days', () => {
    // Arrange
    const dayMap = new Map([
      [3, makeDayActivities(3, [{ type: 'Run', totalMeters: 5000 }])],
      [10, makeDayActivities(10, [{ type: 'Run', totalMeters: 8000 }])],
      [25, makeDayActivities(25, [{ type: 'VirtualRun', totalMeters: 3000 }])],
    ]);

    // Act
    const result = calcMonthSummary(dayMap);

    // Assert
    expect(result.totalMeters).toBe(16000);
  });

  // -----------------------------------------------------------------------
  // 2. 各類型小計正確（per-type subtotals）
  // -----------------------------------------------------------------------
  it('should calculate per-type subtotals correctly', () => {
    // Arrange — Run: 5000 + 8000 = 13000, VirtualRun: 3000
    const dayMap = new Map([
      [
        1,
        makeDayActivities(1, [
          { type: 'Run', totalMeters: 5000 },
          { type: 'VirtualRun', totalMeters: 3000 },
        ]),
      ],
      [15, makeDayActivities(15, [{ type: 'Run', totalMeters: 8000 }])],
    ]);

    // Act
    const result = calcMonthSummary(dayMap);

    // Assert
    const runType = result.byType.find((t) => t.type === 'Run');
    const virtualType = result.byType.find((t) => t.type === 'VirtualRun');
    expect(runType).toBeDefined();
    expect(runType.totalMeters).toBe(13000);
    expect(virtualType).toBeDefined();
    expect(virtualType.totalMeters).toBe(3000);
  });

  // -----------------------------------------------------------------------
  // 3. 零紀錄的類型不出現在 byType
  // -----------------------------------------------------------------------
  it('should exclude types with no records from byType', () => {
    // Arrange — only Run type, no VirtualRun or TrailRun
    const dayMap = new Map([[7, makeDayActivities(7, [{ type: 'Run', totalMeters: 10000 }])]]);

    // Act
    const result = calcMonthSummary(dayMap);

    // Assert — byType only contains Run
    expect(result.byType).toHaveLength(1);
    expect(result.byType[0].type).toBe('Run');
    expect(result.byType.find((t) => t.type === 'VirtualRun')).toBeUndefined();
    expect(result.byType.find((t) => t.type === 'TrailRun')).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // 4. 空 Map → totalMeters: 0, byType: []
  // -----------------------------------------------------------------------
  it('should return totalMeters 0 and empty byType for an empty Map', () => {
    // Arrange
    const dayMap = new Map();

    // Act
    const result = calcMonthSummary(dayMap);

    // Assert
    expect(result.totalMeters).toBe(0);
    expect(result.byType).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 5. label 映射正確（Run→戶外, VirtualRun→室內, TrailRun→越野）
  // -----------------------------------------------------------------------
  it('should map labels correctly via RUN_TYPE_LABELS', () => {
    // Arrange — all three types present
    const dayMap = new Map([
      [
        2,
        makeDayActivities(2, [
          { type: 'Run', totalMeters: 4000 },
          { type: 'VirtualRun', totalMeters: 2000 },
          { type: 'TrailRun', totalMeters: 6000 },
        ]),
      ],
    ]);

    // Act
    const result = calcMonthSummary(dayMap);

    // Assert — verify each type's label
    const runType = result.byType.find((t) => t.type === 'Run');
    const virtualType = result.byType.find((t) => t.type === 'VirtualRun');
    const trailType = result.byType.find((t) => t.type === 'TrailRun');

    expect(runType.label).toBe('戶外');
    expect(virtualType.label).toBe('室內');
    expect(trailType.label).toBe('越野');

    // Also verify RUN_TYPE_LABELS constant is correctly defined
    expect(RUN_TYPE_LABELS).toEqual({
      Run: '戶外',
      VirtualRun: '室內',
      TrailRun: '越野',
    });
  });
});
