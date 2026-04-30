import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return {
    AuthContext: createContext({ user: { uid: 'user-1' }, loading: false }),
  };
});

vi.mock('@/runtime/providers/AuthProvider', async () => {
  const { createContext } = await import('react');
  return {
    AuthContext: createContext({ user: { uid: 'user-1' }, loading: false }),
    default: ({ children }) => children,
  };
});

vi.mock('@/config/client/firebase-client', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
  doc: vi.fn((base, ...segments) => ({
    type: 'doc',
    path: base?.path ? [base.path, ...segments].join('/') : segments.join('/'),
  })),
  query: vi.fn((collRef, ...constraints) => ({
    type: 'query',
    path: collRef?.path,
    constraints,
  })),
  where: vi.fn((field, op, value) => ({ __type: 'where', field, op, value })),
  orderBy: vi.fn((field, dir) => ({ __type: 'orderBy', field, dir })),
  limit: vi.fn((n) => ({ __type: 'limit', n })),
  startAfter: vi.fn((cursor) => ({ __type: 'startAfter', cursor })),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date, __ts: date.getTime() })),
    now: vi.fn(() => ({ toDate: () => new Date() })),
  },
}));

import { getDocs } from 'firebase/firestore';
import RunCalendarDialog from '@/components/RunCalendarDialog';

const mockedGetDocs = /** @type {import('vitest').Mock} */ (getDocs);

/**
 * 建立一個 stravaActivities Firestore document snapshot。
 * @param {string} id - Doc id。
 * @param {{startDateLocal: string, type: string, distanceMeters: number}} data - Activity 資料（日期僅靠 startDateLocal 推算 day number）。
 * @returns {{id: string, data: () => object}} doc snapshot stub。
 */
function createActivityDoc(id, data) {
  return {
    id,
    data: () => ({
      uid: 'user-1',
      stravaId: Number(id.split('-')[1]) || 1,
      name: data.type === 'TrailRun' ? '越野跑' : '晨跑',
      type: data.type,
      distanceMeters: data.distanceMeters,
      movingTimeSec: 1800,
      startDate: { toDate: () => new Date(data.startDateLocal) },
      startDateLocal: data.startDateLocal,
      summaryPolyline: null,
      averageSpeed: 3,
      syncedAt: { toDate: () => new Date() },
    }),
  };
}

/**
 * 取得測試啟動當下的 (year, month) 配對 — 與 RunCalendarDialog 內部 `new Date()` 對齊。
 * @returns {{year: number, month: number}} 當前年月（month 0-11）。
 */
function currentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

/**
 * 為測試月份建立預設 fixture：day 5 一筆 Run 5.2km / day 10 一筆 Run 8km + TrailRun 3km。
 * @param {{year: number, month: number}} ym - 年月。
 * @returns {object[]} doc snapshots。
 */
function buildMonthFixture(ym) {
  const mm = String(ym.month + 1).padStart(2, '0');
  return [
    createActivityDoc('act-1', {
      startDateLocal: `${ym.year}-${mm}-05T07:00:00`,
      type: 'Run',
      distanceMeters: 5200,
    }),
    createActivityDoc('act-2', {
      startDateLocal: `${ym.year}-${mm}-10T07:00:00`,
      type: 'Run',
      distanceMeters: 8000,
    }),
    createActivityDoc('act-3', {
      startDateLocal: `${ym.year}-${mm}-10T18:00:00`,
      type: 'TrailRun',
      distanceMeters: 3000,
    }),
  ];
}

describe('RunCalendarDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // jsdom 不支援 showModal / close
    HTMLDialogElement.prototype.showModal = vi.fn(function showModal() {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function close() {
      this.open = false;
    });

    // 預設：任何 month query 都回固定 fixture（day 5 + day 10）。
    // 這讓 nav 測試可以重複拿同一份 dayMap，但月份標題會因 state 改變。
    mockedGetDocs.mockImplementation(async (queryValue) => {
      // 從 query constraints 抓 startDate 範圍，回對應月的 fixture。
      const startConstraint = queryValue?.constraints?.find(
        (c) => c.__type === 'where' && c.field === 'startDate' && c.op === '>=',
      );
      const ts = startConstraint?.value?.__ts;
      const monthStart = ts ? new Date(ts) : new Date();
      return {
        docs: buildMonthFixture({
          year: monthStart.getFullYear(),
          month: monthStart.getMonth(),
        }),
      };
    });
  });

  describe('Dialog 開啟/關閉', () => {
    it('open=true 時呼叫 showModal', async () => {
      const onClose = vi.fn();

      render(<RunCalendarDialog open onClose={onClose} />);

      expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
      // 等待 hook 真實 fetch 完成，避免 act warning
      await waitFor(() => expect(mockedGetDocs).toHaveBeenCalled());
    });

    it('點擊關閉按鈕呼叫 onClose', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<RunCalendarDialog open onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: '關閉月曆' }));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('日曆網格 rendering', () => {
    it('顯示 weekday headers（日～六）', async () => {
      render(<RunCalendarDialog open onClose={vi.fn()} />);

      const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
      weekdays.forEach((label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
      await waitFor(() => expect(mockedGetDocs).toHaveBeenCalled());
    });

    it('dayMap 含資料時顯示日期數字', async () => {
      render(<RunCalendarDialog open onClose={vi.fn()} />);

      // 真實 hook fetch + service groupActivitiesByDay 後，5 / 10 在 dayActive cell 內
      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
      });
    });
  });

  describe('Icon display per activity type', () => {
    it('dayMap 含不同 type 時顯示對應距離文字', async () => {
      render(<RunCalendarDialog open onClose={vi.fn()} />);

      await waitFor(() => {
        // day 5: Run 5200m → "5.2"
        expect(screen.getByText('5.2')).toBeInTheDocument();
        // day 10: Run 8000m → "8.0", TrailRun 3000m → "3.0"
        expect(screen.getByText('8.0')).toBeInTheDocument();
        expect(screen.getByText('3.0')).toBeInTheDocument();
      });
    });
  });

  describe('月份總結值', () => {
    it('顯示正確的總里程', async () => {
      render(<RunCalendarDialog open onClose={vi.fn()} />);

      // totals: 5200 + 8000 + 3000 = 16200 → 16.2 km
      await waitFor(() => {
        expect(screen.getByText(/16\.2 km/)).toBeInTheDocument();
      });
    });

    it('顯示各類型小計文字', async () => {
      render(<RunCalendarDialog open onClose={vi.fn()} />);

      await waitFor(() => {
        // Run 13200 → 戶外 13.2 km
        expect(screen.getByText(/戶外/)).toBeInTheDocument();
        expect(screen.getByText(/13\.2 km/)).toBeInTheDocument();
        // TrailRun 3000 → 越野 3.0 km
        expect(screen.getByText(/越野/)).toBeInTheDocument();
        expect(screen.getByText(/3\.0 km/)).toBeInTheDocument();
      });
    });
  });

  describe('月份導航', () => {
    /**
     * @param {number} offset - 月份偏移量。
     * @returns {{current: string, target: string}} 當前 + 目標標題。
     */
    function getExpectedTitles(offset) {
      const ym = currentYearMonth();
      const currentTitle = `${ym.year}年${ym.month + 1}月`;
      const targetDate = new Date(ym.year, ym.month + offset, 1);
      const targetTitle = `${targetDate.getFullYear()}年${targetDate.getMonth() + 1}月`;
      return { current: currentTitle, target: targetTitle };
    }

    it('點擊「下一個月」更新月份標題', async () => {
      const user = userEvent.setup();
      const { current, target } = getExpectedTitles(1);

      render(<RunCalendarDialog open onClose={vi.fn()} />);
      expect(screen.getByText(current)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '下一個月' }));

      expect(screen.getByText(target)).toBeInTheDocument();
      // 確認 hook 對新月份發出第二次 query
      await waitFor(() => expect(mockedGetDocs.mock.calls.length).toBeGreaterThanOrEqual(2));
    });

    it('點擊「上一個月」更新月份標題', async () => {
      const user = userEvent.setup();
      const { current, target } = getExpectedTitles(-1);

      render(<RunCalendarDialog open onClose={vi.fn()} />);
      expect(screen.getByText(current)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '上一個月' }));

      expect(screen.getByText(target)).toBeInTheDocument();
      await waitFor(() => expect(mockedGetDocs.mock.calls.length).toBeGreaterThanOrEqual(2));
    });
  });
});
