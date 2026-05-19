import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import EventDetailScreen from '@/ui/events/EventDetailScreen';
import EventsListSection from '@/ui/events/EventsListSection';
import ToastProvider from '@/runtime/providers/ToastProvider';

vi.mock('next/dynamic', () => ({
  default: () => () => <div>Map Mock</div>,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/events/event-1',
}));

vi.mock('@/components/CommentSection', () => ({
  default: () => <div>CommentSection Mock</div>,
}));

vi.mock('@/components/UserLink', () => ({
  default: ({ name }) => <span>{name}</span>,
}));

/**
 * 建立活動 integration fixture。
 * @param {Partial<object>} [overrides] - 覆寫欄位。
 * @returns {object} 活動資料。
 */
function createEvent(overrides = {}) {
  return {
    id: 'event-1',
    title: 'Morning Run',
    time: '2030-05-19T06:00:00Z',
    registrationDeadline: '2030-05-18T22:00:00Z',
    city: '臺北市',
    district: '信義區',
    meetPlace: '象山站',
    distanceKm: 5,
    paceSec: 360,
    maxParticipants: 10,
    participantsCount: 2,
    remainingSeats: 8,
    hostUid: 'host-1',
    hostName: 'Host One',
    hostPhotoURL: '',
    route: null,
    description: '',
    ...overrides,
  };
}

/**
 * Render event list with conservative defaults.
 * @param {object} options - render options.
 * @param {object[]} options.events - 活動列表。
 * @param {object | null} options.user - 目前使用者。
 * @param {Set<string>} [options.favoriteEventIds] - 已收藏活動 ID。
 * @param {(eventId: string) => void} [options.onToggleFavoriteEvent] - 收藏切換回呼。
 */
function renderEventsList({
  events,
  user,
  favoriteEventIds = new Set(),
  onToggleFavoriteEvent = vi.fn(),
}) {
  render(
    <EventsListSection
      events={events}
      user={user}
      isLoadingEvents={false}
      isFiltering={false}
      isCreating={false}
      loadError={null}
      isFilteredResults={false}
      isLoadingMore={false}
      loadMoreError={null}
      hasMore={false}
      sentinelRef={{ current: null }}
      isFormOpen={false}
      pendingByEventId={{}}
      myJoinedEventIds={new Set()}
      membershipStatusByEventId={{}}
      favoriteEventIds={favoriteEventIds}
      getRemainingSeats={(event) => event.remainingSeats}
      onJoin={vi.fn()}
      onLeave={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onOpenFilter={vi.fn()}
      onToggleFavoriteEvent={onToggleFavoriteEvent}
      loadMore={vi.fn()}
    />,
  );
}

/**
 * 建立 detail runtime fixture。
 * @param {object} options - runtime options。
 * @param {object} options.event - 活動資料。
 * @param {object | null} options.user - 目前使用者。
 * @param {boolean} [options.isFavoriteEvent] - 是否已收藏。
 * @returns {object} detail runtime。
 */
function createDetailRuntime({ event, user, isFavoriteEvent = false }) {
  return {
    user,
    event,
    loading: false,
    error: null,
    participants: [],
    participantsLoading: false,
    participantsError: null,
    isParticipantsOpen: false,
    participantsOverlayRef: { current: null },
    pending: null,
    editingEvent: null,
    isUpdating: false,
    deletingEventId: null,
    isDeletingEvent: false,
    statusText: '報名中',
    hasRoute: false,
    routePolylines: [],
    routePointCount: 0,
    remainingSeats: 8,
    participationState: 'can_join',
    shareUrl: `https://example.com/events/${event.id}`,
    isFavoriteEvent,
    isTogglingFavoriteEvent: false,
    handleOpenParticipants: vi.fn(),
    handleCloseParticipants: vi.fn(),
    refreshParticipants: vi.fn(),
    handleJoin: vi.fn(),
    handleLeave: vi.fn(),
    handleEditEvent: vi.fn(),
    handleEditCancel: vi.fn(),
    handleEditSubmit: vi.fn(),
    handleDeleteEventRequest: vi.fn(),
    handleDeleteCancel: vi.fn(),
    handleDeleteConfirm: vi.fn(),
    handleCommentAdded: vi.fn(),
    handleToggleFavoriteEvent: vi.fn(),
  };
}

describe('Event favorites integration', () => {
  it('renders accessible feed bookmark buttons with pressed state', () => {
    renderEventsList({
      user: { uid: 'viewer-1' },
      events: [createEvent(), createEvent({ id: 'event-2', title: 'Night Run' })],
      favoriteEventIds: new Set(['event-1']),
    });

    expect(screen.getByRole('button', { name: '取消收藏活動：Morning Run' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '收藏活動：Night Run' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('keeps the feed bookmark in an action cluster separate from the host menu', async () => {
    const user = userEvent.setup();
    renderEventsList({
      user: { uid: 'host-1' },
      events: [createEvent()],
    });

    const actionGroup = screen.getByRole('group', { name: 'Morning Run 操作' });
    expect(
      within(actionGroup).getByRole('button', { name: '收藏活動：Morning Run' }),
    ).toBeInTheDocument();
    await user.click(within(actionGroup).getByRole('button', { name: '更多操作' }));

    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: '編輯活動' })).toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: /收藏活動/ })).not.toBeInTheDocument();
  });

  it('shows feed bookmarks for non-host users when the host menu is absent', () => {
    renderEventsList({
      user: { uid: 'viewer-1' },
      events: [createEvent()],
    });

    const actionGroup = screen.getByRole('group', { name: 'Morning Run 操作' });
    expect(
      within(actionGroup).getByRole('button', { name: '收藏活動：Morning Run' }),
    ).toBeInTheDocument();
    expect(within(actionGroup).queryByRole('button', { name: '更多操作' })).not.toBeInTheDocument();
  });

  it('renders the detail bookmark in the title action cluster with share status and menu', () => {
    const event = createEvent();
    const runtime = createDetailRuntime({
      event,
      user: { uid: 'host-1' },
      isFavoriteEvent: true,
    });

    render(
      <ToastProvider>
        <EventDetailScreen id={event.id} runtime={runtime} />
      </ToastProvider>,
    );

    const actionGroup = screen.getByRole('group', { name: '活動操作' });
    expect(within(actionGroup).getByRole('button', { name: '取消收藏活動：Morning Run' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(within(actionGroup).getByRole('button', { name: '分享' })).toBeInTheDocument();
    expect(within(actionGroup).getByText('報名中')).toBeInTheDocument();
    expect(within(actionGroup).getByRole('button', { name: '更多操作' })).toBeInTheDocument();
  });
});
