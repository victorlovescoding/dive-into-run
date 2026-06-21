// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@testing-library/react';
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
    onClearFilters: vi.fn(),
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

describe('EventsListSection event status badges', () => {
  it('renders one availability pill per card using full before deadline before open priority', () => {
    renderList({
      user: { uid: runnerUid },
      events: [
        createEvent({
          id: 'event-full',
          title: '額滿優先活動',
          remainingSeats: 0,
          registrationDeadline: '2000-01-01T11:00:00.000Z',
        }),
        createEvent({
          id: 'event-closed',
          title: '截止活動',
          remainingSeats: 3,
          registrationDeadline: '2000-01-01T11:00:00.000Z',
        }),
        createEvent({
          id: 'event-open',
          title: '開放報名活動',
          remainingSeats: 3,
          registrationDeadline: '2099-01-01T11:00:00.000Z',
        }),
      ],
      getRemainingSeats: vi.fn((event) => event.remainingSeats),
    });

    const fullCard = within(screen.getByTestId('event-card-event-full'));
    expect(fullCard.getByText('額滿')).toBeInTheDocument();
    expect(fullCard.queryByText('已截止')).not.toBeInTheDocument();
    expect(fullCard.queryByText('報名中')).not.toBeInTheDocument();

    const closedCard = within(screen.getByTestId('event-card-event-closed'));
    expect(closedCard.getByText('已截止')).toBeInTheDocument();
    expect(closedCard.queryByText('額滿')).not.toBeInTheDocument();
    expect(closedCard.queryByText('報名中')).not.toBeInTheDocument();

    const openCard = within(screen.getByTestId('event-card-event-open'));
    expect(openCard.getByText('報名中')).toBeInTheDocument();
    expect(openCard.queryByText('額滿')).not.toBeInTheDocument();
    expect(openCard.queryByText('已截止')).not.toBeInTheDocument();
  });

  it('renders personal badges for logged-in hosts and joined users with host priority', () => {
    renderList({
      user: { uid: runnerUid },
      events: [
        createEvent({
          id: 'event-host',
          title: '我是主揪活動',
          hostUid: runnerUid,
          remainingSeats: 4,
        }),
        createEvent({
          id: 'event-member-status',
          title: '狀態已報名活動',
          hostUid,
          remainingSeats: 4,
        }),
        createEvent({
          id: 'event-member-set',
          title: '集合已報名活動',
          hostUid,
          remainingSeats: 4,
        }),
      ],
      myJoinedEventIds: new Set(['event-host', 'event-member-set']),
      membershipStatusByEventId: {
        'event-host': 'joined',
        'event-member-status': 'joined',
      },
      getRemainingSeats: vi.fn((event) => event.remainingSeats),
    });

    const hostCard = within(screen.getByTestId('event-card-event-host'));
    expect(hostCard.getByText('你是主揪')).toBeInTheDocument();
    expect(hostCard.queryByText('你已報名')).not.toBeInTheDocument();

    expect(
      within(screen.getByTestId('event-card-event-member-status')).getByText('你已報名'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('event-card-event-member-set')).getByText('你已報名'),
    ).toBeInTheDocument();
  });

  it('does not render personal badges when there is no logged-in user', () => {
    renderList({
      user: null,
      events: [createEvent({ id: 'event-anonymous', remainingSeats: 4 })],
      myJoinedEventIds: new Set(['event-anonymous']),
      membershipStatusByEventId: { 'event-anonymous': 'joined' },
      getRemainingSeats: vi.fn((event) => event.remainingSeats),
    });

    const card = within(screen.getByTestId('event-card-event-anonymous'));
    expect(card.queryByText('你是主揪')).not.toBeInTheDocument();
    expect(card.queryByText('你已報名')).not.toBeInTheDocument();
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

  it('renders stored run type slugs as localized card chips', () => {
    renderList({
      events: [
        createEvent({
          title: '河濱變速跑',
          runType: 'fartlek',
        }),
        createEvent({
          id: 'event-2',
          title: '操場節奏跑',
          runType: 'tempo_run',
        }),
      ],
    });

    expect(screen.getByText('變速跑')).toBeInTheDocument();
    expect(screen.getByText('節奏跑')).toBeInTheDocument();
    expect(screen.queryByText('fartlek')).not.toBeInTheDocument();
    expect(screen.queryByText('tempo_run')).not.toBeInTheDocument();
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

  it('renders a clear filters button for applied chips and calls onClearFilters', async () => {
    const { props, user } = renderList({
      appliedFilters: {
        city: '台北市',
        district: '大安區',
        startTime: '',
        endTime: '',
        minDistance: '',
        maxDistance: '',
        hasSeatsOnly: true,
      },
    });

    await user.click(screen.getByRole('button', { name: '清除篩選' }));

    expect(props.onClearFilters).toHaveBeenCalledWith();
  });

  it('does not render the clear filters button without applied chips', () => {
    renderList({
      appliedFilters: {},
    });

    expect(screen.queryByRole('button', { name: '清除篩選' })).not.toBeInTheDocument();
  });
});
