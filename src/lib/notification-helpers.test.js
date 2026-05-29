import { describe, expect, test } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { getNotificationLink } from './notification-helpers';

describe('notification helper links', () => {
  test('links event_host_joined notifications to event detail', () => {
    expect(
      getNotificationLink({
        id: 'notification-1',
        recipientUid: 'host-1',
        type: 'event_host_joined',
        actorUid: 'runner-1',
        actorName: '小明',
        actorPhotoURL: '',
        entityType: 'event',
        entityId: 'event-1',
        entityTitle: '週末晨跑',
        commentId: null,
        message: '小明 報名了你的活動「週末晨跑」',
        read: false,
        createdAt: Timestamp.fromDate(new Date(0)),
      }),
    ).toBe('/events/event-1');
  });
});
