import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventDetailClient from '@/app/events/[id]/eventDetailClient';
import {
  fetchEventById,
  fetchParticipants,
  fetchMyJoinedEventsForIds,
} from '@/runtime/client/use-cases/event-use-cases';
import { notifyEventNewComment } from '@/runtime/client/use-cases/notification-use-cases';
import { AuthContext } from '@/runtime/providers/AuthProvider';

const mockShowToast = vi.fn();

vi.mock('@/runtime/client/use-cases/event-use-cases', () => ({
  fetchEventById: vi.fn(),
  fetchParticipants: vi.fn(),
  fetchMyJoinedEventsForIds: vi.fn(),
  joinEvent: vi.fn(),
  leaveEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  EVENT_NOT_FOUND_MESSAGE: '活動不存在',
}));

vi.mock('@/runtime/client/use-cases/notification-use-cases', () => ({
  notifyEventModified: vi.fn().mockResolvedValue(undefined),
  notifyEventCancelled: vi.fn().mockResolvedValue(undefined),
  notifyEventNewComment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/runtime/providers/AuthProvider', async () => {
  const { createContext } = await import('react');
  return {
    AuthContext: createContext({ user: null, setUser: () => {}, loading: false }),
  };
});

vi.mock('@/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

vi.mock('next/link', () => ({
  default: (
    /** @type {{ children: import('react').ReactNode, href: string }} */ {
      children,
      href,
      ...props
    },
  ) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/ShareButton', () => ({
  default: () => <button type="button">Share</button>,
}));

vi.mock('@/components/UserLink', () => ({
  default: (/** @type {{ name?: string }} */ { name }) => <span>{name || ''}</span>,
}));

vi.mock('@/components/CommentSection', () => ({
  default: (/** @type {{ onCommentAdded?: (commentId: string) => void }} */ { onCommentAdded }) => (
    <button type="button" onClick={() => onCommentAdded?.('comment-123')}>
      trigger comment callback
    </button>
  ),
}));

const mockedFetchEventById = /** @type {import('vitest').Mock} */ (fetchEventById);
const mockedFetchParticipants = /** @type {import('vitest').Mock} */ (fetchParticipants);
const mockedFetchMyJoinedEventsForIds = /** @type {import('vitest').Mock} */ (
  fetchMyJoinedEventsForIds
);
const mockedNotifyEventNewComment = /** @type {import('vitest').Mock} */ (notifyEventNewComment);

const mockUser = {
  uid: 'runner-1',
  name: 'Runner One',
  email: 'runner@example.com',
  photoURL: 'https://photo.url/runner.jpg',
  bio: null,
  getIdToken: async () => '',
};

describe('EventDetailClient comment notification runtime wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchEventById.mockResolvedValue({
      id: 'evt1',
      title: '週末晨跑',
      time: '2099-12-27T07:00',
      registrationDeadline: '2099-12-26T23:59',
      city: '台北市',
      district: '大安區',
      meetPlace: '大安森林公園',
      distanceKm: 5,
      paceSec: 360,
      maxParticipants: 20,
      participantsCount: 2,
      remainingSeats: 18,
      hostUid: 'host-99',
      hostName: 'Host User',
      hostPhotoURL: 'https://photo.url/host.jpg',
      description: '一起來跑步吧',
    });
    mockedFetchParticipants.mockResolvedValue([]);
    mockedFetchMyJoinedEventsForIds.mockResolvedValue(new Set());
    mockedNotifyEventNewComment.mockResolvedValue(undefined);
  });

  it('routes CommentSection callback through detail runtime and calls notifyEventNewComment', async () => {
    const user = userEvent.setup();

    render(
      <AuthContext.Provider value={{ user: mockUser, setUser: vi.fn(), loading: false }}>
        <EventDetailClient id="evt1" />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText('週末晨跑')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'trigger comment callback' }));

    await waitFor(() => {
      expect(mockedNotifyEventNewComment).toHaveBeenCalledWith(
        'evt1',
        '週末晨跑',
        'host-99',
        'comment-123',
        {
          uid: 'runner-1',
          name: 'Runner One',
          photoURL: 'https://photo.url/runner.jpg',
        },
      );
    });
    expect(mockShowToast).not.toHaveBeenCalledWith(expect.stringContaining('失敗'), 'error');
  });
});
