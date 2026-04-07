import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock useRunCalendar hook
vi.mock('@/hooks/useRunCalendar', () => ({
  default: vi.fn(),
}));

import useRunCalendar from '@/hooks/useRunCalendar';
import RunCalendarDialog from '@/components/RunCalendarDialog';

const mockedUseRunCalendar = /** @type {import('vitest').Mock} */ (useRunCalendar);

/** @type {Map<number, import('@/lib/strava-helpers').DayActivities>} 測試用 dayMap。 */
const mockDayMap = new Map([
  [
    5,
    {
      dateKey: '2026-04-05',
      day: 5,
      runs: [{ type: 'Run', totalMeters: 5200 }],
      totalMeters: 5200,
    },
  ],
  [
    10,
    {
      dateKey: '2026-04-10',
      day: 10,
      runs: [
        { type: 'Run', totalMeters: 8000 },
        { type: 'TrailRun', totalMeters: 3000 },
      ],
      totalMeters: 11000,
    },
  ],
]);

/** @type {import('@/lib/strava-helpers').MonthSummary} 測試用月份總結。 */
const mockMonthSummary = {
  totalMeters: 16200,
  byType: [
    { type: 'Run', totalMeters: 13200, label: '戶外' },
    { type: 'TrailRun', totalMeters: 3000, label: '越野' },
  ],
};

describe('RunCalendarDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // jsdom 不支援 showModal / close，需要手動 mock
    HTMLDialogElement.prototype.showModal = vi.fn(function () {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function () {
      this.open = false;
    });

    mockedUseRunCalendar.mockReturnValue({
      dayMap: mockDayMap,
      monthSummary: mockMonthSummary,
      isLoading: false,
      error: null,
    });
  });

  describe('Dialog 開啟/關閉', () => {
    it('open=true 時呼叫 showModal', () => {
      // Arrange
      const onClose = vi.fn();

      // Act
      render(<RunCalendarDialog open={true} onClose={onClose} />);

      // Assert
      expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    });

    it('點擊關閉按鈕呼叫 onClose', async () => {
      // Arrange
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<RunCalendarDialog open={true} onClose={onClose} />);

      // Act
      await user.click(screen.getByRole('button', { name: '關閉月曆' }));

      // Assert
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('日曆網格 rendering', () => {
    it('顯示 weekday headers（日～六）', () => {
      // Arrange & Act
      render(<RunCalendarDialog open={true} onClose={vi.fn()} />);

      // Assert
      const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
      weekdays.forEach((label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it('dayMap 含資料時顯示日期數字', () => {
      // Arrange & Act
      render(<RunCalendarDialog open={true} onClose={vi.fn()} />);

      // Assert — 日曆格應包含 day 5 和 day 10
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  describe('Icon display per activity type', () => {
    it('dayMap 含不同 type 時顯示對應距離文字', () => {
      // Arrange & Act
      render(<RunCalendarDialog open={true} onClose={vi.fn()} />);

      // Assert — day 5: Run 5200m → "5.2"
      expect(screen.getByText('5.2')).toBeInTheDocument();
      // day 10: Run 8000m → "8.0", TrailRun 3000m → "3.0"
      expect(screen.getByText('8.0')).toBeInTheDocument();
      expect(screen.getByText('3.0')).toBeInTheDocument();
    });
  });

  describe('月份總結值', () => {
    it('顯示正確的總里程', () => {
      // Arrange & Act
      render(<RunCalendarDialog open={true} onClose={vi.fn()} />);

      // Assert — 16200m → "16.2 km"
      expect(screen.getByText(/16\.2 km/)).toBeInTheDocument();
    });

    it('顯示各類型小計文字', () => {
      // Arrange & Act
      render(<RunCalendarDialog open={true} onClose={vi.fn()} />);

      // Assert — 戶外 13.2 km, 越野 3.0 km
      expect(screen.getByText(/戶外/)).toBeInTheDocument();
      expect(screen.getByText(/13\.2 km/)).toBeInTheDocument();
      expect(screen.getByText(/越野/)).toBeInTheDocument();
      expect(screen.getByText(/3\.0 km/)).toBeInTheDocument();
    });
  });

  describe('月份導航', () => {
    /**
     * 根據當前系統時間計算預期的月份標題。
     * @param {number} offset - 月份偏移量（+1 = 下個月，-1 = 上個月）。
     * @returns {{ current: string, target: string }} 當前與目標月份標題。
     */
    function getExpectedTitles(offset) {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const currentTitle = `${year}年${month + 1}月`;

      const targetDate = new Date(year, month + offset, 1);
      const targetTitle = `${targetDate.getFullYear()}年${targetDate.getMonth() + 1}月`;
      return { current: currentTitle, target: targetTitle };
    }

    it('點擊「下一個月」更新月份標題', async () => {
      // Arrange
      const user = userEvent.setup();
      const { current, target } = getExpectedTitles(1);

      render(<RunCalendarDialog open={true} onClose={vi.fn()} />);
      expect(screen.getByText(current)).toBeInTheDocument();

      // Act
      await user.click(screen.getByRole('button', { name: '下一個月' }));

      // Assert
      expect(screen.getByText(target)).toBeInTheDocument();
    });

    it('點擊「上一個月」更新月份標題', async () => {
      // Arrange
      const user = userEvent.setup();
      const { current, target } = getExpectedTitles(-1);

      render(<RunCalendarDialog open={true} onClose={vi.fn()} />);
      expect(screen.getByText(current)).toBeInTheDocument();

      // Act
      await user.click(screen.getByRole('button', { name: '上一個月' }));

      // Assert
      expect(screen.getByText(target)).toBeInTheDocument();
    });
  });
});
