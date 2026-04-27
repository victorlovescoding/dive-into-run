import { describe, expect, it, vi, beforeEach } from 'vitest';

const addNotificationDocuments = vi.fn();
const fetchDistinctEventCommentAuthors = vi.fn();
const fetchDistinctPostCommentAuthors = vi.fn();
const fetchParticipantUids = vi.fn();
const fetchMoreNotificationDocuments = vi.fn();
const fetchMoreUnreadNotificationDocuments = vi.fn();
const markNotificationAsRead = vi.fn();
const watchNotificationDocuments = vi.fn();
const watchUnreadNotificationDocuments = vi.fn();

vi.mock('@/repo/client/firebase-notifications-repo', () => ({
  addNotificationDocuments,
  fetchDistinctEventCommentAuthors,
  fetchDistinctPostCommentAuthors,
  fetchParticipantUids,
  fetchMoreNotificationDocuments,
  fetchMoreUnreadNotificationDocuments,
  markNotificationAsRead,
  watchNotificationDocuments,
  watchUnreadNotificationDocuments,
}));

vi.mock('@/repo/client/firebase-events-repo', () => ({
  fetchParticipantUids,
}));

const runtime = await import('@/runtime/client/use-cases/notification-use-cases');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('notification-use-cases split', () => {
  it('notifyPostCommentReply filters recipients in runtime', async () => {
    fetchDistinctPostCommentAuthors.mockResolvedValue(['actor', 'author', 'reply-target']);

    await runtime.notifyPostCommentReply('post-1', '晨跑心得', 'author', 'c1', {
      uid: 'actor',
      name: 'Amy',
      photoURL: 'https://img',
    });

    expect(addNotificationDocuments).toHaveBeenCalledTimes(1);
    const [payloads] = addNotificationDocuments.mock.calls[0];
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toEqual(
      expect.objectContaining({
        recipientUid: 'reply-target',
        type: 'post_comment_reply',
        entityType: 'post',
        entityId: 'post-1',
        entityTitle: '晨跑心得',
        commentId: 'c1',
      }),
    );
  });

  it('notifyEventNewComment deduplicates host participants and comment authors in runtime', async () => {
    fetchParticipantUids.mockResolvedValue(['host', 'participant-1', 'actor']);
    fetchDistinctEventCommentAuthors.mockResolvedValue(['actor', 'participant-1', 'commenter-1']);

    await runtime.notifyEventNewComment('event-1', '週末活動', 'host', 'c2', {
      uid: 'actor',
      name: 'Amy',
      photoURL: 'https://img',
    });

    expect(fetchParticipantUids).toHaveBeenCalledWith('event-1');
    expect(addNotificationDocuments).toHaveBeenCalledTimes(1);
    const [payloads] = addNotificationDocuments.mock.calls[0];
    expect(payloads.map((payload) => payload.recipientUid)).toEqual([
      'host',
      'participant-1',
      'commenter-1',
    ]);
  });

  it('watchNotifications maps raw documents to notification items', async () => {
    const onNext = vi.fn();
    const onError = vi.fn();
    watchNotificationDocuments.mockImplementation((uid, next, _error) => {
      next([{ id: 'n1', data: () => ({ recipientUid: uid }) }], null);
      return () => {};
    });

    const unsubscribe = runtime.watchNotifications('u1', onNext, onError);

    expect(typeof unsubscribe).toBe('function');
    expect(onNext).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'n1', recipientUid: 'u1' })],
      null,
    );
  });
});
