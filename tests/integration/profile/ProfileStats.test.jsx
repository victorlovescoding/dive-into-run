/**
 * @file Integration tests for `ProfileStats` — stats card on public profile page.
 * @description
 * TDD RED phase — target component does NOT exist yet:
 *   `src/app/users/[uid]/ProfileStats.jsx`
 *
 * Covers US1 Acceptance Scenario 2 and Strava edge cases:
 *   - AS2: 顯示 hostedCount / joinedCount / totalDistanceKm
 *   - Edge: totalDistanceKm === null (未連結 Strava) → 公里數欄位完全隱藏
 *   - Edge: totalDistanceKm === 0 (已連結 Strava) → 顯示 `0 km`
 *   - Edge: count 為 0 → 正常顯示 `0`
 *
 * Rules:
 * 1. Use `@testing-library/react` — query by `getByRole` / `getByText`.
 * 2. AAA Pattern (Arrange, Act, Assert) is mandatory.
 * 3. Strict JSDoc; no `any`.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

/* ==========================================================================
   Type Definitions
   ========================================================================== */

/**
 * @typedef {object} MockProfileStats
 * @property {number} hostedCount - 主辦活動數量。
 * @property {number} joinedCount - 參加活動數量。
 * @property {number | null} totalDistanceKm - 累計跑步公里數（null = 未連結 Strava）。
 */

/**
 * 建立測試用 ProfileStats。
 * @param {Partial<MockProfileStats>} [overrides] - 覆蓋欄位。
 * @returns {MockProfileStats} 測試資料。
 */
function createStats(overrides = {}) {
  return {
    hostedCount: 5,
    joinedCount: 12,
    totalDistanceKm: 42.7,
    ...overrides,
  };
}

/**
 * 動態載入 ProfileStats 元件。
 * @returns {Promise<(props: { stats: MockProfileStats }) => import('react').ReactElement>}
 *   ProfileStats 元件。
 */
async function importProfileStats() {
  const mod = await import('@/app/users/[uid]/ProfileStats');
  return /** @type {(props: { stats: MockProfileStats }) => import('react').ReactElement} */ (
    mod.default
  );
}

/* ==========================================================================
   Tests
   ========================================================================== */

describe('Integration: ProfileStats', () => {
  // --- AS2: 三欄齊全 ---
  it('renders hosted, joined and distance stats when all present', async () => {
    // Arrange
    const ProfileStats = await importProfileStats();
    const stats = createStats({ hostedCount: 5, joinedCount: 12, totalDistanceKm: 42.7 });

    // Act
    render(<ProfileStats stats={stats} />);

    // Assert — 三個數字都能找到
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    // 公里數應帶單位 `km`，可接受 `42.7 km` / `42.7km`
    const distance = screen.getByText(/42\.?7\s?km/);
    expect(distance).toBeInTheDocument();

    // 三欄 label
    expect(screen.getByText(/開團/)).toBeInTheDocument();
    expect(screen.getByText(/參團/)).toBeInTheDocument();
    expect(screen.getByText(/累計|公里|距離/)).toBeInTheDocument();
  });

  // --- Edge: totalDistanceKm === null → 欄位完全隱藏 ---
  it('hides distance stat entirely when totalDistanceKm is null', async () => {
    // Arrange
    const ProfileStats = await importProfileStats();
    const stats = createStats({ totalDistanceKm: null });

    // Act
    render(<ProfileStats stats={stats} />);

    // Assert — 開團 / 參團仍顯示
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    // 不應出現任何 `km` 字樣或 `累計` label
    expect(screen.queryByText(/km/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/累計|公里|距離/)).not.toBeInTheDocument();
  });

  // --- Edge: totalDistanceKm === 0 (已連結 Strava) → 顯示 `0 km` ---
  it('shows `0 km` when totalDistanceKm is 0 (Strava connected but no activities)', async () => {
    // Arrange
    const ProfileStats = await importProfileStats();
    const stats = createStats({ totalDistanceKm: 0 });

    // Act
    render(<ProfileStats stats={stats} />);

    // Assert — 應出現 `0` 的公里數，且 label 仍存在
    expect(screen.getByText(/累計|公里|距離/)).toBeInTheDocument();
    const distance = screen.getByText(/0\s?km/);
    expect(distance).toBeInTheDocument();
  });

  // --- Edge: hostedCount 與 joinedCount 都是 0 ---
  it('renders 0 for hosted and joined counts when user has no activity', async () => {
    // Arrange
    const ProfileStats = await importProfileStats();
    const stats = createStats({ hostedCount: 0, joinedCount: 0, totalDistanceKm: null });

    // Act
    render(<ProfileStats stats={stats} />);

    // Assert — 兩個 0 都要顯示
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText(/開團/)).toBeInTheDocument();
    expect(screen.getByText(/參團/)).toBeInTheDocument();
  });

  // --- totalDistanceKm 為整數時仍要顯示單位 ---
  it('renders integer distance with km unit', async () => {
    // Arrange
    const ProfileStats = await importProfileStats();
    const stats = createStats({ totalDistanceKm: 100 });

    // Act
    render(<ProfileStats stats={stats} />);

    // Assert
    expect(screen.getByText(/100\s?km/)).toBeInTheDocument();
  });
});
