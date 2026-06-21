// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EventsListSection from '@/ui/events/EventsListSection';

const routerPush = vi.fn();
const hostUid = 'host-1';
const runnerUid = 'runner-1';
const startedLockReason = '活動已開始，無法編輯或刪除。';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock('next/link', () => ({
  default: ({ href, className, children }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/UserLink', () => ({
  default: ({ name }) => <span>{name}</span>,
}));

/**
 * 建立 list section event fixture。
 * @param {Record<string, unknown>} overrides - 覆寫欄位。
 * @returns {Record<string, unknown>} 活動 fixture。
 */
function createEvent(overrides = {}) {
  return {
    id: 'event-1',
    title: '已開始晨跑',
    city: '台北市',
    district: '大安區',
    meetPlace: '森林公園',
    distanceKm: 5,
    paceSec: 360,
    runType: '晨跑',
    maxParticipants: 10,
    participantsCount: 2,
    remainingSeats: 8,
    hostUid,
    hostName: '主揪',
    hostPhotoURL: '',
    time: '2000-01-01T10:00:00.000Z',
    registrationDeadline: '2099-01-01T11:00:00.000Z',
    ...overrides,
  };
}

/**
 * 建立 EventsListSection props。
 * @param {Record<string, unknown>} overrides - 覆寫 props。
 * @returns {Record<string, unknown>} Component props。
 */
function createProps(overrides = {}) {
  return {
    events: [createEvent()],
    user: { uid: hostUid },
    isLoadingEvents: false,
    isFiltering: false,
    isCreating: false,
    loadError: null,
    isFilteredResults: false,
    appliedFilters: {},
    isLoadingMore: false,
    loadMoreError: null,
    hasMore: false,
    sentinelRef: { current: null },
    isFormOpen: false,
    pendingByEventId: {},
    myJoinedEventIds: new Set(),
    membershipStatusByEventId: {},
    favoriteEventIds: new Set(),
    getRemainingSeats: vi.fn(() => 8),
    onJoin: vi.fn(),
    onLeave: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggleFavoriteEvent: vi.fn(),
    onOpenFilter: vi.fn(),
    loadMore: vi.fn(),
    ...overrides,
  };
}

/**
 * Render EventsListSection with default props.
 * @param {Record<string, unknown>} propOverrides - Props 覆寫。
 * @returns {{ props: Record<string, unknown>, user: ReturnType<typeof userEvent.setup> }}
 * 渲染後的 props 與 user-event instance。
 */
function renderList(propOverrides = {}) {
  const props = createProps(propOverrides);
  const user = userEvent.setup();

  render(<EventsListSection {...props} />);

  return { props, user };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('EventsListSection started event non-body interactions', () => {
  it('renders a started host event with disabled owner menu while keeping favorite wired', async () => {
    const { props, user } = renderList({
      favoriteEventIds: new Set(['event-1']),
    });

    expect(screen.getByRole('heading', { name: '已開始晨跑' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '更多操作' }));

    expect(
      screen.getByRole('menuitem', { name: `編輯活動 ${startedLockReason}` }),
    ).toBeDisabled();
    expect(
      screen.getByRole('menuitem', { name: `刪除活動 ${startedLockReason}` }),
    ).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '取消收藏活動：已開始晨跑' }));

    expect(props.onToggleFavoriteEvent).toHaveBeenCalledWith('event-1');
    expect(props.onEdit).not.toHaveBeenCalled();
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('keeps started non-host favorite and join controls wired', async () => {
    const { props, user } = renderList({
      user: { uid: runnerUid },
      events: [createEvent()],
      membershipStatusByEventId: { 'event-1': 'notJoined' },
    });

    expect(screen.getByRole('heading', { name: '已開始晨跑' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '更多操作' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '收藏活動：已開始晨跑' }));
    await user.click(screen.getByRole('button', { name: '參加活動' }));

    expect(props.onToggleFavoriteEvent).toHaveBeenCalledWith('event-1');
    expect(props.onJoin).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'event-1' }),
      expect.any(Object),
    );
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('keeps started non-host leave control wired for joined users', async () => {
    const { props, user } = renderList({
      user: { uid: runnerUid },
      events: [createEvent()],
      membershipStatusByEventId: { 'event-1': 'joined' },
      myJoinedEventIds: new Set(['event-1']),
    });

    await user.click(screen.getByRole('button', { name: '退出活動' }));

    expect(props.onLeave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'event-1' }),
      expect.any(Object),
    );
    expect(routerPush).not.toHaveBeenCalled();
  });
});

describe('EventsListSection card scanning summary', () => {
  it('renders run type, status, remaining seats, and capacity progress for each card', () => {
    renderList({
      events: [
        createEvent({
          title: '河濱間歇',
          runType: '晨跑',
          maxParticipants: 10,
          participantsCount: 2,
          remainingSeats: 8,
          time: '2000-01-01T10:00:00.000Z',
          registrationDeadline: '1999-12-31T10:00:00.000Z',
        }),
      ],
      getRemainingSeats: vi.fn(() => 8),
    });

    expect(screen.getByText('晨跑')).toBeInTheDocument();
    expect(screen.getByText('活動已開始')).toBeInTheDocument();
    expect(screen.getByText('剩 8 / 10 名')).toBeInTheDocument();

    const capacityProgress = screen.getByRole('progressbar', {
      name: '河濱間歇名額使用狀態',
    });
    expect(capacityProgress).toHaveAttribute('aria-valuemin', '0');
    expect(capacityProgress).toHaveAttribute('aria-valuemax', '10');
    expect(capacityProgress).toHaveAttribute('aria-valuenow', '2');
  });

  it('renders chips for applied filters', () => {
    renderList({
      appliedFilters: {
        city: '台北市',
        district: '大安區',
        startTime: '2026-07-01T06:00',
        endTime: '',
        minDistance: '5',
        maxDistance: '',
        hasSeatsOnly: true,
      },
    });

    expect(screen.getByText('地點：台北市 大安區')).toBeInTheDocument();
    expect(screen.getByText('時間：2026-07-01 06:00 起')).toBeInTheDocument();
    expect(screen.getByText('距離：5 km 以上')).toBeInTheDocument();
    expect(screen.getByText('有名額')).toBeInTheDocument();
  });
});
