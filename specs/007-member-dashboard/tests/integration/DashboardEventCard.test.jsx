import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/link', () => ({
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

vi.mock('@/lib/event-helpers', () => ({
  formatDateTime: vi.fn(),
}));

/** @type {import('vitest').Mock} */
const mockFormatDateTime = /** @type {any} */ (
  (await import('@/lib/event-helpers')).formatDateTime
);

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * 建立一個假的 Firestore Timestamp。
 * @param {number} ms - 毫秒時間戳。
 * @returns {{ seconds: number, nanoseconds: number, toMillis: () => number, toDate: () => Date }} 假 Timestamp。
 */
function fakeTimestamp(ms) {
  return {
    seconds: Math.floor(ms / 1000),
    nanoseconds: 0,
    toMillis: () => ms,
    toDate: () => new Date(ms),
  };
}

/** 基礎活動資料 — 未來活動。 */
const FUTURE_MS = Date.now() + 86400000;
/** 基礎活動資料 — 過去活動。 */
const PAST_MS = Date.now() - 86400000;

/**
 * 建立基本測試用活動資料。
 * @param {Partial<import('@/lib/firebase-member').MyEventItem>} [overrides] - 覆蓋欄位。
 * @returns {import('@/lib/firebase-member').MyEventItem} 活動資料。
 */
function createEvent(overrides = {}) {
  return {
    id: 'evt-001',
    title: '週末晨跑',
    time: /** @type {any} */ (fakeTimestamp(FUTURE_MS)),
    location: '大安森林公園',
    city: '台北市',
    participantsCount: 3,
    maxParticipants: 10,
    hostUid: 'host-uid-1',
    ...overrides,
  };
}

describe('DashboardEventCard', () => {
  /**
   * 動態 import，避免 module cache 問題。
   * @returns {Promise<typeof import('@/components/DashboardEventCard').default>} component。
   */
  async function importComponent() {
    const mod = await import('@/components/DashboardEventCard');
    return mod.default;
  }

  // --- 1. Title renders as link ---
  it('renders title as a link to /events/{id}', async () => {
    const DashboardEventCard = await importComponent();
    const event = createEvent();
    mockFormatDateTime.mockReturnValue('2026-04-08 08:00');

    render(<DashboardEventCard event={event} isHost={false} />);

    const link = screen.getByRole('link', { name: '週末晨跑' });
    expect(link).toHaveAttribute('href', '/events/evt-001');
  });

  // --- 2. Renders formatted datetime ---
  it('renders formatted datetime from formatDateTime', async () => {
    const DashboardEventCard = await importComponent();
    const event = createEvent();
    mockFormatDateTime.mockReturnValue('2026-04-08 08:00');

    render(<DashboardEventCard event={event} isHost={false} />);

    expect(mockFormatDateTime).toHaveBeenCalledWith(event.time);
    expect(screen.getByText('2026-04-08 08:00')).toBeInTheDocument();
  });

  // --- 3. Renders location and city ---
  it('renders city and location', async () => {
    const DashboardEventCard = await importComponent();
    const event = createEvent();
    mockFormatDateTime.mockReturnValue('2026-04-08 08:00');

    render(<DashboardEventCard event={event} isHost={false} />);

    expect(screen.getByText(/台北市/)).toBeInTheDocument();
    expect(screen.getByText(/大安森林公園/)).toBeInTheDocument();
  });

  // --- 4. Renders participants count ---
  it('renders participants count as "current / max"', async () => {
    const DashboardEventCard = await importComponent();
    const event = createEvent({ participantsCount: 3, maxParticipants: 10 });
    mockFormatDateTime.mockReturnValue('2026-04-08 08:00');

    render(<DashboardEventCard event={event} isHost={false} />);

    expect(screen.getByText('3 / 10')).toBeInTheDocument();
  });

  // --- 5. Shows host badge when isHost=true ---
  it('shows host badge when isHost is true', async () => {
    const DashboardEventCard = await importComponent();
    const event = createEvent();
    mockFormatDateTime.mockReturnValue('2026-04-08 08:00');

    render(<DashboardEventCard event={event} isHost={true} />);

    expect(screen.getByText('主辦')).toBeInTheDocument();
  });

  // --- 6. Hides host badge when isHost=false ---
  it('does not show host badge when isHost is false', async () => {
    const DashboardEventCard = await importComponent();
    const event = createEvent();
    mockFormatDateTime.mockReturnValue('2026-04-08 08:00');

    render(<DashboardEventCard event={event} isHost={false} />);

    expect(screen.queryByText('主辦')).not.toBeInTheDocument();
  });

  // --- 7. Future event shows upcoming badge ---
  it('shows "即將到來" badge for future events', async () => {
    const DashboardEventCard = await importComponent();
    const event = createEvent({ time: /** @type {any} */ (fakeTimestamp(FUTURE_MS)) });
    mockFormatDateTime.mockReturnValue('2026-04-08 08:00');

    render(<DashboardEventCard event={event} isHost={false} />);

    expect(screen.getByText('即將到來')).toBeInTheDocument();
    expect(screen.queryByText('已結束')).not.toBeInTheDocument();
  });

  // --- 8. Past event shows ended badge ---
  it('shows "已結束" badge for past events', async () => {
    const DashboardEventCard = await importComponent();
    const event = createEvent({ time: /** @type {any} */ (fakeTimestamp(PAST_MS)) });
    mockFormatDateTime.mockReturnValue('2026-04-06 08:00');

    render(<DashboardEventCard event={event} isHost={false} />);

    expect(screen.getByText('已結束')).toBeInTheDocument();
    expect(screen.queryByText('即將到來')).not.toBeInTheDocument();
  });
});
