/**
 * @file Unit tests for buildCalendarGrid — 產生月曆網格陣列。
 *
 * 驗證月首日對齊（null padding）與各月天數正確性，
 * 涵蓋 31/30/28/29 天月份及星期日～六邊界情境。
 */
import { describe, it, expect } from 'vitest';
import { buildCalendarGrid } from '@/lib/strava-helpers';

// ---------------------------------------------------------------------------
// buildCalendarGrid
// ---------------------------------------------------------------------------
describe('Unit: buildCalendarGrid', () => {
  // -----------------------------------------------------------------------
  // 1. 月首日對齊正確（月初是星期三 → 前面 3 個 null）
  // -----------------------------------------------------------------------
  it('should prepend 3 nulls when the 1st falls on Wednesday', () => {
    // Arrange — 2025-01 (January 2025): 1st is Wednesday
    const year = 2025;
    const month = 0; // January

    // Act
    const grid = buildCalendarGrid(year, month);

    // Assert — first 3 entries are null, 4th entry is 1
    expect(grid[0]).toBeNull();
    expect(grid[1]).toBeNull();
    expect(grid[2]).toBeNull();
    expect(grid[3]).toBe(1);
  });

  // -----------------------------------------------------------------------
  // 2. 正確天數 — 31 天月份
  // -----------------------------------------------------------------------
  it('should produce 31 date entries for a 31-day month', () => {
    // Arrange — 2025-01 (January): 31 days
    const year = 2025;
    const month = 0;

    // Act
    const grid = buildCalendarGrid(year, month);
    const dates = grid.filter((cell) => cell !== null);

    // Assert
    expect(dates).toHaveLength(31);
    expect(dates[0]).toBe(1);
    expect(dates[dates.length - 1]).toBe(31);
  });

  // -----------------------------------------------------------------------
  // 3. 正確天數 — 30 天月份
  // -----------------------------------------------------------------------
  it('should produce 30 date entries for a 30-day month', () => {
    // Arrange — 2025-04 (April): 30 days
    const year = 2025;
    const month = 3;

    // Act
    const grid = buildCalendarGrid(year, month);
    const dates = grid.filter((cell) => cell !== null);

    // Assert
    expect(dates).toHaveLength(30);
    expect(dates[dates.length - 1]).toBe(30);
  });

  // -----------------------------------------------------------------------
  // 4. 正確天數 — 28 天月份（非閏年二月）
  // -----------------------------------------------------------------------
  it('should produce 28 date entries for February in a non-leap year', () => {
    // Arrange — 2025-02 (February 2025): 28 days
    const year = 2025;
    const month = 1;

    // Act
    const grid = buildCalendarGrid(year, month);
    const dates = grid.filter((cell) => cell !== null);

    // Assert
    expect(dates).toHaveLength(28);
    expect(dates[dates.length - 1]).toBe(28);
  });

  // -----------------------------------------------------------------------
  // 5. null padding 正確 — 所有 null 在前，日期連續遞增
  // -----------------------------------------------------------------------
  it('should have all nulls at the front followed by consecutive dates', () => {
    // Arrange — 2025-03 (March 2025): 1st is Saturday → 6 nulls
    const year = 2025;
    const month = 2;

    // Act
    const grid = buildCalendarGrid(year, month);

    // Assert — find the first non-null index
    const firstDateIndex = grid.findIndex((cell) => cell !== null);
    // All entries before firstDateIndex should be null
    for (let i = 0; i < firstDateIndex; i++) {
      expect(grid[i]).toBeNull();
    }
    // All entries from firstDateIndex onward should be consecutive 1..N
    for (let i = firstDateIndex; i < grid.length; i++) {
      expect(grid[i]).toBe(i - firstDateIndex + 1);
    }
  });

  // -----------------------------------------------------------------------
  // 6. 閏年二月（2024 年 2 月 → 29 天）
  // -----------------------------------------------------------------------
  it('should produce 29 date entries for February in a leap year (2024)', () => {
    // Arrange — 2024-02 (February 2024): 29 days, 1st is Thursday → 4 nulls
    const year = 2024;
    const month = 1;

    // Act
    const grid = buildCalendarGrid(year, month);
    const dates = grid.filter((cell) => cell !== null);

    // Assert
    expect(dates).toHaveLength(29);
    expect(dates[dates.length - 1]).toBe(29);
    // Verify total length = 4 nulls + 29 days
    expect(grid).toHaveLength(4 + 29);
  });

  // -----------------------------------------------------------------------
  // 7. 月初是星期日（前面 0 個 null）
  // -----------------------------------------------------------------------
  it('should prepend 0 nulls when the 1st falls on Sunday', () => {
    // Arrange — 2025-06 (June 2025): 1st is Sunday
    const year = 2025;
    const month = 5;

    // Act
    const grid = buildCalendarGrid(year, month);

    // Assert — first entry is 1, no nulls
    expect(grid[0]).toBe(1);
    expect(grid.filter((cell) => cell === null)).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // 8. 月初是星期六（前面 6 個 null）
  // -----------------------------------------------------------------------
  it('should prepend 6 nulls when the 1st falls on Saturday', () => {
    // Arrange — 2025-03 (March 2025): 1st is Saturday
    const year = 2025;
    const month = 2;

    // Act
    const grid = buildCalendarGrid(year, month);

    // Assert — first 6 entries are null, 7th is 1
    const nullCount = grid.filter((cell) => cell === null).length;
    expect(nullCount).toBe(6);
    expect(grid[6]).toBe(1);
    // Total length = 6 nulls + 31 days (March)
    expect(grid).toHaveLength(6 + 31);
  });
});
