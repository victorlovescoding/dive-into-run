// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EventDetailScreen from '@/ui/events/EventDetailScreen';

const bookmarkButtonProps = [];
const commentSectionProps = [];
const eventCardMenuProps = [];
const eventDeleteConfirmProps = [];
const participantsModalProps = [];
const shareButtonProps = [];
const userLinkProps = [];
const hostUid = 'host-1';
const nonHostUid = 'runner-1';
const startedLockReason = '活動已開始，無法編輯或刪除。';

vi.mock('next/dynamic', () => ({
  default: () => function MockDynamicComponent() {
    return <div data-testid="dynamic-component" />;
  },
}));

vi.mock('next/link', () => ({
  default: ({ href, className, children }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/BookmarkButton', () => ({
  default: (props) => {
    bookmarkButtonProps.push(props);
    return (
      <button type="button" disabled={props.disabled} onClick={props.onClick}>
        {props.isActive ? props.activeLabel : props.label}
      </button>
    );
  },
}));

vi.mock('@/components/CommentSection', () => ({
  default: (props) => {
    commentSectionProps.push(props);
    return <section aria-label="活動留言" />;
  },
}));

vi.mock('@/components/EventCardMenu', () => ({
  default: (props) => {
    eventCardMenuProps.push(props);
    return <div data-testid="event-card-menu" />;
  },
}));

vi.mock('@/components/EventDeleteConfirm', () => ({
  default: (props) => {
    eventDeleteConfirmProps.push(props);
    return <div role="dialog" aria-label="刪除活動" />;
  },
}));

vi.mock('@/components/EventEditForm', () => ({
  default: () => <form aria-label="編輯活動" />,
}));

vi.mock('@/components/ShareButton', () => ({
  default: (props) => {
    shareButtonProps.push(props);
    return <button type="button">分享 {props.title}</button>;
  },
}));

vi.mock('@/components/UserLink', () => ({
  default: (props) => {
    userLinkProps.push(props);
    return <span>{props.name}</span>;
  },
}));

vi.mock('@/ui/events/ParticipantsModal', () => ({
  default: (props) => {
    participantsModalProps.push(props);
    return props.isOpen ? <div role="dialog" aria-label="參加名單" /> : null;
  },
}));

/**
 * 建立 host 視角的 detail event fixture。
 * @param {Record<string, unknown>} overrides - 覆寫欄位。
 * @returns {Record<string, unknown>} 活動 fixture。
 */
function createHostEvent(overrides = {}) {
  return {
    id: 'event-1',
    title: '晨跑團',
    city: '台北市',
    district: '大安區',
    meetPlace: '森林公園',
    distanceKm: 5,
    maxParticipants: 10,
    participantsCount: 2,
    remainingSeats: 8,
    paceSec: 360,
    hostUid,
    hostName: '主揪',
    hostPhotoURL: '',
    time: '2026-07-01T10:00:00.000Z',
    registrationDeadline: '2026-06-30T10:00:00.000Z',
    description: '一起跑',
    ...overrides,
  };
}

/**
 * 建立非 host 視角的 detail event fixture。
 * @param {Record<string, unknown>} overrides - 覆寫欄位。
 * @returns {Record<string, unknown>} 活動 fixture。
 */
function createNonHostEvent(overrides = {}) {
  return createHostEvent({
    hostUid: 'another-host',
    hostName: '其他主揪',
    ...overrides,
  });
}

/**
 * 建立 EventDetailScreen runtime fixture。
 * @param {Record<string, unknown>} overrides - Runtime 覆寫欄位。
 * @returns {Record<string, unknown>} Runtime fixture。
 */
function createRuntime(overrides = {}) {
  return {
    user: { uid: hostUid, name: '目前使用者' },
    event: createHostEvent(),
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
    isFavoriteEvent: false,
    isTogglingFavoriteEvent: false,
    statusText: '尚未開始',
    hasRoute: false,
    routePolylines: [],
    routePointCount: 0,
    remainingSeats: 8,
    participationState: 'can_join',
    shareUrl: 'https://example.test/events/event-1',
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
    ...overrides,
  };
}

/**
 * 建立已開始活動 fixture。
 * @param {Record<string, unknown>} overrides - 覆寫欄位。
 * @returns {Record<string, unknown>} 已開始活動 fixture。
 */
function createStartedEvent(overrides = {}) {
  return createHostEvent({
    time: '2026-07-01T10:00:00.000Z',
    ...overrides,
  });
}

/**
 * Render detail screen with runtime overrides.
 * @param {Record<string, unknown>} runtimeOverrides - Runtime 覆寫欄位。
 * @returns {ReturnType<typeof render>} Render result.
 */
function renderScreen(runtimeOverrides = {}) {
  return render(
    <EventDetailScreen id="event-1" runtime={createRuntime(runtimeOverrides)} />,
  );
}

afterEach(() => {
  bookmarkButtonProps.length = 0;
  commentSectionProps.length = 0;
  eventCardMenuProps.length = 0;
  eventDeleteConfirmProps.length = 0;
  participantsModalProps.length = 0;
  shareButtonProps.length = 0;
  userLinkProps.length = 0;
  vi.clearAllMocks();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-01T10:00:00.000Z'));
});

describe('EventDetailScreen started-lock fixtures', () => {
  it('provides reusable host event fixture data to owner menu assertions', () => {
    renderScreen();

    expect(screen.getByText('晨跑團')).toBeInTheDocument();
    expect(eventCardMenuProps.at(-1)).toMatchObject({
      event: expect.objectContaining({ id: 'event-1', hostUid }),
      currentUserUid: hostUid,
    });
  });

  it('provides reusable non-host event fixture data to permission-priority assertions', () => {
    renderScreen({
      user: { uid: nonHostUid, name: '非主揪' },
      event: createNonHostEvent(),
    });

    expect(eventCardMenuProps.at(-1)).toMatchObject({
      event: expect.objectContaining({ id: 'event-1', hostUid: 'another-host' }),
      currentUserUid: nonHostUid,
    });
  });
});

describe('EventDetailScreen started event non-body actions', () => {
  it('keeps comment creation passthrough available and does not add detail-level delete blocking props', () => {
    const handleCommentAdded = vi.fn();
    renderScreen({
      event: createStartedEvent(),
      handleCommentAdded,
    });

    const commentProps = commentSectionProps.at(-1);
    expect(screen.getByRole('region', { name: '活動留言' })).toBeInTheDocument();
    expect(commentProps).toMatchObject({
      eventId: 'event-1',
      onCommentAdded: handleCommentAdded,
    });
    expect(commentProps).not.toHaveProperty('disabled');
    expect(commentProps).not.toHaveProperty('disabledReason');

    commentProps?.onCommentAdded('comment-1');

    expect(handleCommentAdded).toHaveBeenCalledWith('comment-1');
  });

  it('keeps favorite action wired for a started event', () => {
    const handleToggleFavoriteEvent = vi.fn();
    renderScreen({
      event: createStartedEvent(),
      isFavoriteEvent: false,
      handleToggleFavoriteEvent,
    });

    expect(bookmarkButtonProps.at(-1)).toMatchObject({
      isActive: false,
      disabled: false,
      label: '收藏活動：晨跑團',
      activeLabel: '取消收藏活動：晨跑團',
      onClick: handleToggleFavoriteEvent,
    });
    bookmarkButtonProps.at(-1)?.onClick();
    expect(handleToggleFavoriteEvent).toHaveBeenLastCalledWith();
  });

  it('keeps unfavorite action wired for a started event', () => {
    const handleToggleFavoriteEvent = vi.fn();
    renderScreen({
      event: createStartedEvent(),
      isFavoriteEvent: true,
      handleToggleFavoriteEvent,
    });

    expect(bookmarkButtonProps.at(-1)).toMatchObject({
      isActive: true,
      disabled: false,
      label: '收藏活動：晨跑團',
      activeLabel: '取消收藏活動：晨跑團',
      onClick: handleToggleFavoriteEvent,
    });
    bookmarkButtonProps.at(-1)?.onClick();
    expect(handleToggleFavoriteEvent).toHaveBeenLastCalledWith();
  });

  it('keeps share props wired for a started event', () => {
    renderScreen({
      event: createStartedEvent(),
      shareUrl: 'https://example.test/events/event-1?from=share',
    });

    expect(screen.getByRole('button', { name: '分享 晨跑團' })).toBeInTheDocument();
    expect(shareButtonProps.at(-1)).toMatchObject({
      title: '晨跑團',
      url: 'https://example.test/events/event-1?from=share',
    });
  });
});

describe('EventDetailScreen started event identity display', () => {
  it('keeps host identity rendered for a started event', () => {
    renderScreen({
      event: createStartedEvent({
        hostName: '開始後主揪',
        hostPhotoURL: 'https://example.test/host.png',
      }),
    });

    expect(screen.getByText('開始後主揪')).toBeInTheDocument();
    expect(userLinkProps.at(-1)).toMatchObject({
      uid: hostUid,
      name: '開始後主揪',
      photoURL: 'https://example.test/host.png',
      size: 28,
    });
  });

  it('keeps participant identity modal props wired for a started event', () => {
    const participants = [
      { uid: hostUid, name: '開始後主揪', photoURL: 'https://example.test/host.png' },
      { uid: nonHostUid, name: '參加者', photoURL: 'https://example.test/runner.png' },
    ];
    const handleCloseParticipants = vi.fn();
    const refreshParticipants = vi.fn();
    const participantsOverlayRef = { current: null };
    renderScreen({
      event: createStartedEvent(),
      participants,
      isParticipantsOpen: true,
      participantsLoading: false,
      participantsError: null,
      handleCloseParticipants,
      refreshParticipants,
      participantsOverlayRef,
    });

    expect(screen.getByRole('dialog', { name: '參加名單' })).toBeInTheDocument();
    expect(participantsModalProps.at(-1)).toMatchObject({
      participants,
      loading: false,
      error: null,
      isOpen: true,
      onClose: handleCloseParticipants,
      onRetry: refreshParticipants,
      overlayRef: participantsOverlayRef,
      hostUid,
    });
  });
});

describe('EventDetailScreen owner menu started edit lock', () => {
  it('passes exact edit disabled reason for host viewing a started event', () => {
    renderScreen({
      event: createHostEvent({ time: '2026-07-01T10:00:00.000Z' }),
    });

    expect(eventCardMenuProps.at(-1)).toMatchObject({
      currentUserUid: hostUid,
      editDisabledReason: startedLockReason,
    });
  });

  it('keeps host edit enabled before event start', () => {
    renderScreen({
      event: createHostEvent({ time: '2026-07-01T10:00:01.000Z' }),
    });

    expect(eventCardMenuProps.at(-1)?.editDisabledReason).toBe('');
  });

  it('does not expose started-lock edit reason to non-host users', () => {
    renderScreen({
      user: { uid: nonHostUid, name: '非主揪' },
      event: createNonHostEvent({ time: '2026-07-01T10:00:00.000Z' }),
    });

    expect(eventCardMenuProps.at(-1)).toMatchObject({
      currentUserUid: nonHostUid,
    });
    expect(eventCardMenuProps.at(-1)?.editDisabledReason).toBe('');
  });
});

describe('EventDetailScreen delete confirmation started lock', () => {
  it('passes exact delete disabled reason to owner menu for host viewing a started event', () => {
    renderScreen({
      event: createHostEvent({ time: '2026-07-01T10:00:00.000Z' }),
    });

    expect(eventCardMenuProps.at(-1)).toMatchObject({
      currentUserUid: hostUid,
      deleteDisabledReason: startedLockReason,
    });
  });

  it('passes exact delete disabled reason for host confirming a started event delete', () => {
    renderScreen({
      event: createHostEvent({ time: '2026-07-01T10:00:00.000Z' }),
      deletingEventId: 'event-1',
    });

    expect(eventDeleteConfirmProps.at(-1)).toMatchObject({
      eventId: 'event-1',
      disabledReason: startedLockReason,
    });
  });

  it('keeps host delete confirmation enabled before event start', () => {
    renderScreen({
      event: createHostEvent({ time: '2026-07-01T10:00:01.000Z' }),
      deletingEventId: 'event-1',
    });

    expect(eventDeleteConfirmProps.at(-1)?.disabledReason).toBe('');
  });

  it('does not expose started-lock delete reason to non-host users', () => {
    renderScreen({
      user: { uid: nonHostUid, name: '非主揪' },
      event: createNonHostEvent({ time: '2026-07-01T10:00:00.000Z' }),
      deletingEventId: 'event-1',
    });

    expect(eventDeleteConfirmProps.at(-1)?.disabledReason).toBe('');
  });
});
