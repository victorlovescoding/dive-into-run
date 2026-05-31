/* eslint-disable jsdoc/require-jsdoc -- Focused UI behavior tests use local doubles. */
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import EventsListSection from './EventsListSection';

const routerPushMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

vi.mock('next/link', () => ({
  default: function MockLink({ href, children, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock('next/image', () => ({
  default: function MockImage({ alt, src, width, height, className, style }) {
    return (
      <img
        alt={alt}
        className={className}
        data-height={height}
        data-src={src}
        data-width={width}
        src={src}
        style={style}
      />
    );
  },
}));

const RUNNER_USER = {
  uid: 'runner-1',
  displayName: '跑者一號',
  email: 'runner@example.com',
  photoURL: 'runner.png',
};

const FUTURE_TIME = '2999-06-01T06:00:00.000Z';
const FUTURE_DEADLINE = '2999-05-31T12:00:00.000Z';

function createEvent(overrides = {}) {
  return {
    id: 'event-1',
    title: '山徑節奏跑',
    time: FUTURE_TIME,
    registrationDeadline: FUTURE_DEADLINE,
    city: '台北市',
    district: '大安區',
    meetPlace: '大安森林公園 5 號出口',
    distanceKm: 7.5,
    paceSec: 365,
    pace: '',
    maxParticipants: 12,
    participantsCount: 4,
    remainingSeats: 8,
    hostUid: 'host-1',
    hostName: '林小路',
    hostPhotoURL: 'host.png',
    route: { pointsCount: 3 },
    ...overrides,
  };
}

function createOwnedEvent(overrides = {}) {
  return createEvent({
    id: 'event-owner',
    title: '我的配速課',
    hostUid: RUNNER_USER.uid,
    hostName: '跑者一號',
    hostPhotoURL: RUNNER_USER.photoURL,
    ...overrides,
  });
}

function createProps(overrides = {}) {
  return {
    events: [createEvent(), createOwnedEvent()],
    user: RUNNER_USER,
    isLoadingEvents: false,
    isFiltering: false,
    isCreating: false,
    loadError: null,
    isFilteredResults: false,
    isLoadingMore: false,
    loadMoreError: null,
    hasMore: true,
    sentinelRef: createRef(),
    isFormOpen: false,
    pendingByEventId: {},
    myJoinedEventIds: new Set(),
    membershipStatusByEventId: {},
    favoriteEventIds: new Set(),
    getRemainingSeats: vi.fn((event) => event.remainingSeats ?? 0),
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

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function elementHasTextParts(element, textParts) {
  const text = normalizeText(element.textContent ?? '');
  return textParts.every((part) => text.includes(part));
}

function getSmallestTextBlock(...textParts) {
  return screen.getByText((_content, element) => {
    if (!(element instanceof HTMLElement)) return false;
    if (!elementHasTextParts(element, textParts)) return false;

    return Array.from(element.children).every(
      (child) => !(child instanceof HTMLElement) || !elementHasTextParts(child, textParts),
    );
  });
}

describe('EventsListSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders the event fields, formatter output, owner menu, bookmark, and participation action', () => {
    const view = render(<EventsListSection {...createProps({ events: [createEvent()] })} />);

    expect(screen.getByRole('link', { name: '山徑節奏跑' })).toHaveAttribute(
      'href',
      '/events/event-1',
    );
    expect(screen.getByRole('link', { name: '林小路' })).toHaveAttribute(
      'href',
      '/users/host-1',
    );
    expect(getSmallestTextBlock('時間', '2999-06-01 06:00:00.000Z')).toBeInTheDocument();
    expect(getSmallestTextBlock('報名截止', '2999-05-31 12:00:00.000Z')).toBeInTheDocument();
    expect(getSmallestTextBlock('地點', '台北市 大安區')).toBeInTheDocument();
    expect(getSmallestTextBlock('集合', '大安森林公園 5 號出口')).toBeInTheDocument();
    expect(getSmallestTextBlock('距離', '7.5 km')).toBeInTheDocument();
    expect(getSmallestTextBlock('配速', '06:05 /km')).toBeInTheDocument();
    expect(getSmallestTextBlock('人數上限', '12')).toBeInTheDocument();
    expect(getSmallestTextBlock('剩餘名額', '8')).toBeInTheDocument();
    expect(getSmallestTextBlock('路線', '已設定（3 點）')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '收藏活動：山徑節奏跑' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '參加活動' })).toBeInTheDocument();

    view.unmount();
    render(<EventsListSection {...createProps({ events: [createOwnedEvent()] })} />);

    expect(screen.getByRole('button', { name: '更多操作' })).toBeInTheDocument();
  });

  test('preserves loading, filtering, creating, empty, error, load-more, and end-hint text', async () => {
    const user = userEvent.setup();
    const renderState = (overrides) => render(<EventsListSection {...createProps(overrides)} />);

    let view = renderState({ events: [], isLoadingEvents: true });
    expect(screen.getByRole('status')).toHaveTextContent('正在載入活動…');
    view.unmount();

    view = renderState({ events: [], isFiltering: true });
    expect(screen.getByRole('status')).toHaveTextContent('正在篩選活動…');
    view.unmount();

    view = renderState({ events: [], isCreating: true });
    expect(screen.getByRole('status')).toHaveTextContent('正在建立活動…');
    view.unmount();

    view = renderState({ events: [] });
    expect(screen.getByText('目前還沒有活動（先建立一筆看看）')).toBeInTheDocument();
    view.unmount();

    view = renderState({ events: [], isFilteredResults: true });
    expect(screen.getByText('沒有符合條件的活動')).toBeInTheDocument();
    view.unmount();

    view = renderState({ loadError: '活動載入失敗' });
    expect(screen.getByRole('alert')).toHaveTextContent('活動載入失敗');
    view.unmount();

    const loadMore = vi.fn();
    view = renderState({ loadMoreError: '載入更多活動失敗', loadMore });
    expect(screen.getByRole('alert')).toHaveTextContent('載入更多活動失敗');
    await user.click(screen.getByRole('button', { name: '重試' }));
    expect(loadMore).toHaveBeenCalledTimes(1);
    view.unmount();

    view = renderState({ isLoadingMore: true });
    expect(screen.getByText('載入更多活動…')).toBeInTheDocument();
    view.unmount();

    view = renderState({ hasMore: false });
    expect(screen.getByText('已經到底了')).toBeInTheDocument();
    view.unmount();
  });

  test('clicking the event card background navigates to event detail', async () => {
    const user = userEvent.setup();
    render(<EventsListSection {...createProps()} />);

    await user.click(screen.getByTestId('event-card-event-1'));

    expect(routerPushMock).toHaveBeenCalledTimes(1);
    expect(routerPushMock).toHaveBeenCalledWith('/events/event-1');
  });

  test('clicking bookmark toggles the favorite event without card navigation', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<EventsListSection {...props} />);

    await user.click(screen.getByRole('button', { name: '收藏活動：山徑節奏跑' }));

    expect(props.onToggleFavoriteEvent).toHaveBeenCalledTimes(1);
    expect(props.onToggleFavoriteEvent).toHaveBeenCalledWith('event-1');
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  test('clicking the owner menu trigger, edit item, and delete item avoids card navigation', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<EventsListSection {...props} />);

    const menuTrigger = screen.getByRole('button', { name: '更多操作' });

    await user.click(menuTrigger);
    expect(props.onEdit).not.toHaveBeenCalled();
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(props.onJoin).not.toHaveBeenCalled();
    expect(props.onLeave).not.toHaveBeenCalled();
    expect(props.onToggleFavoriteEvent).not.toHaveBeenCalled();
    expect(routerPushMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('menuitem', { name: '編輯活動' }));
    expect(props.onEdit).toHaveBeenCalledTimes(1);
    expect(props.onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'event-owner' }));
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(routerPushMock).not.toHaveBeenCalled();

    await user.click(menuTrigger);
    await user.click(screen.getByRole('menuitem', { name: '刪除活動' }));
    expect(props.onDelete).toHaveBeenCalledTimes(1);
    expect(props.onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'event-owner' }));
    expect(props.onEdit).toHaveBeenCalledTimes(1);
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  test('clicking join or leave calls the participation handler without card navigation', async () => {
    const user = userEvent.setup();
    const event = createEvent();
    const joinProps = createProps({ events: [event] });
    const view = render(<EventsListSection {...joinProps} />);

    await user.click(screen.getByRole('button', { name: '參加活動' }));
    expect(joinProps.onJoin).toHaveBeenCalledTimes(1);
    expect(joinProps.onJoin.mock.calls[0][0]).toMatchObject({ id: 'event-1' });
    expect(joinProps.onLeave).not.toHaveBeenCalled();
    expect(routerPushMock).not.toHaveBeenCalled();

    view.unmount();
    routerPushMock.mockClear();

    const leaveProps = createProps({
      events: [event],
      myJoinedEventIds: new Set(['event-1']),
      membershipStatusByEventId: { 'event-1': 'joined' },
    });
    render(<EventsListSection {...leaveProps} />);

    await user.click(screen.getByRole('button', { name: '退出活動' }));
    expect(leaveProps.onLeave).toHaveBeenCalledTimes(1);
    expect(leaveProps.onLeave.mock.calls[0][0]).toMatchObject({ id: 'event-1' });
    expect(leaveProps.onJoin).not.toHaveBeenCalled();
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  test('clicking full, deadline, and checking participation states does not navigate the card', async () => {
    const user = userEvent.setup();
    const scenarios = [
      {
        buttonName: '已額滿',
        event: createEvent({ participantsCount: 12, remainingSeats: 0 }),
        props: {},
      },
      {
        buttonName: '報名已截止',
        event: createEvent({ registrationDeadline: '2000-01-01T00:00:00.000Z' }),
        props: {},
      },
      {
        buttonName: /確認報名狀態/,
        event: createEvent(),
        props: { membershipStatusByEventId: { 'event-1': 'checking' } },
      },
    ];

    for (const scenario of scenarios) {
      const props = createProps({ events: [scenario.event], ...scenario.props });
      const view = render(<EventsListSection {...props} />);

      await user.click(screen.getByRole('button', { name: scenario.buttonName }));

      expect(props.onJoin).not.toHaveBeenCalled();
      expect(props.onLeave).not.toHaveBeenCalled();
      expect(routerPushMock).not.toHaveBeenCalled();
      view.unmount();
      routerPushMock.mockClear();
    }
  });
});
