import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  addNotificationDocument,
  addNotificationDocuments,
} from '@/repo/client/firebase-notifications-repo';
import { fetchParticipantUids } from '@/repo/client/firebase-events-repo';
import { serverTimestamp } from 'firebase/firestore';
import { notifyEventHostJoined } from './notification-use-cases';

const serverTimestampValue = { type: 'serverTimestamp' };

vi.mock('firebase/firestore', () => ({
  serverTimestamp: vi.fn(() => serverTimestampValue),
}));

vi.mock('@/repo/client/firebase-notifications-repo', () => ({
  addNotificationDocument: vi.fn(),
  addNotificationDocuments: vi.fn(),
  fetchDistinctCommentAuthors: vi.fn(),
  fetchDistinctEventCommentAuthors: vi.fn(),
  fetchDistinctPostCommentAuthors: vi.fn(),
  fetchMoreNotificationDocuments: vi.fn(),
  fetchMoreUnreadNotificationDocuments: vi.fn(),
  markNotificationAsRead: vi.fn(),
  watchNotificationDocuments: vi.fn(),
  watchUnreadNotificationDocuments: vi.fn(),
}));

vi.mock('@/repo/client/firebase-events-repo', () => ({
  fetchParticipantUids: vi.fn(),
}));

const addNotificationDocumentMock = vi.mocked(addNotificationDocument);
const addNotificationDocumentsMock = vi.mocked(addNotificationDocuments);
const fetchParticipantUidsMock = vi.mocked(fetchParticipantUids);
const serverTimestampMock = vi.mocked(serverTimestamp);

describe('notifyEventHostJoined', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('writes one event_host_joined notification to the event host', async () => {
    await notifyEventHostJoined('event-1', '週末晨跑', 'host-1', {
      uid: 'runner-1',
      name: '小明',
      photoURL: 'avatar.png',
    });

    expect(addNotificationDocumentMock).toHaveBeenCalledTimes(1);
    expect(addNotificationDocumentMock).toHaveBeenCalledWith({
      recipientUid: 'host-1',
      type: 'event_host_joined',
      actorUid: 'runner-1',
      actorName: '小明',
      actorPhotoURL: 'avatar.png',
      entityType: 'event',
      entityId: 'event-1',
      entityTitle: '週末晨跑',
      commentId: null,
      message: '小明 報名了你的活動「週末晨跑」',
      read: false,
      createdAt: serverTimestampValue,
    });
    expect(serverTimestampMock).toHaveBeenCalledTimes(1);
    expect(addNotificationDocumentsMock).not.toHaveBeenCalled();
    expect(fetchParticipantUidsMock).not.toHaveBeenCalled();
  });

  test('skips host self-notification', async () => {
    await notifyEventHostJoined('event-1', '週末晨跑', 'host-1', {
      uid: 'host-1',
      name: '主揪',
      photoURL: 'host.png',
    });

    expect(addNotificationDocumentMock).not.toHaveBeenCalled();
    expect(addNotificationDocumentsMock).not.toHaveBeenCalled();
    expect(serverTimestampMock).not.toHaveBeenCalled();
    expect(fetchParticipantUidsMock).not.toHaveBeenCalled();
  });

  test.each(['', '   ', null, undefined])('skips missing host uid: %s', async (hostUid) => {
    await notifyEventHostJoined('event-1', '週末晨跑', hostUid, {
      uid: 'runner-1',
      name: '小明',
      photoURL: 'avatar.png',
    });

    expect(addNotificationDocumentMock).not.toHaveBeenCalled();
    expect(addNotificationDocumentsMock).not.toHaveBeenCalled();
    expect(serverTimestampMock).not.toHaveBeenCalled();
    expect(fetchParticipantUidsMock).not.toHaveBeenCalled();
  });

  test.each(['', '   ', null, undefined])('skips missing actor uid: %s', async (actorUid) => {
    await notifyEventHostJoined('event-1', '週末晨跑', 'host-1', {
      uid: actorUid,
      name: '小明',
      photoURL: 'avatar.png',
    });

    expect(addNotificationDocumentMock).not.toHaveBeenCalled();
    expect(addNotificationDocumentsMock).not.toHaveBeenCalled();
    expect(serverTimestampMock).not.toHaveBeenCalled();
    expect(fetchParticipantUidsMock).not.toHaveBeenCalled();
  });
});
