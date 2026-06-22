import { describe, expect, it } from 'vitest';
import { getNotificationLink } from '../../../src/lib/notification-helpers';

/**
 * Builds the minimum notification shape needed by getNotificationLink.
 * @param {object} overrides - Notification field overrides.
 * @returns {import('../../../src/service/notification-service').NotificationItem} Notification.
 */
function notification(overrides) {
  return {
    id: 'notification-1',
    recipientUid: 'recipient-1',
    type: 'event_modified',
    actorUid: 'actor-1',
    actorName: 'Runner',
    actorPhotoURL: '',
    entityType: 'event',
    entityId: 'event-1',
    entityTitle: '晨跑',
    commentId: null,
    message: '通知訊息',
    read: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('getNotificationLink', () => {
  it.each([
    ['post_new_comment', 'post', 'post-1', 'comment-1', '/posts/post-1?commentId=comment-1'],
    ['post_comment_reply', 'post', 'post-1', 'comment-2', '/posts/post-1?commentId=comment-2'],
    ['event_host_comment', 'event', 'event-1', 'comment-3', '/events/event-1?commentId=comment-3'],
    [
      'event_participant_comment',
      'event',
      'event-1',
      'comment-4',
      '/events/event-1?commentId=comment-4',
    ],
    ['event_comment_reply', 'event', 'event-1', 'comment-5', '/events/event-1?commentId=comment-5'],
    ['event_modified', 'event', 'event-1', null, '/events/event-1'],
    ['event_cancelled', 'event', 'event-1', null, '/events/event-1'],
    ['event_host_joined', 'event', 'event-1', null, '/events/event-1'],
  ])('maps %s notifications to the expected URL', (type, entityType, entityId, commentId, url) => {
    expect(getNotificationLink(notification({ type, entityType, entityId, commentId }))).toBe(url);
  });

  it('omits commentId query params when comment notifications do not have a comment id', () => {
    expect(
      getNotificationLink(
        notification({
          type: 'post_new_comment',
          entityType: 'post',
          entityId: 'post-1',
          commentId: null,
        }),
      ),
    ).toBe('/posts/post-1');
    expect(
      getNotificationLink(
        notification({
          type: 'event_comment_reply',
          entityType: 'event',
          entityId: 'event-1',
          commentId: undefined,
        }),
      ),
    ).toBe('/events/event-1');
  });

  it('falls back to the entity list when entity id is missing', () => {
    expect(
      getNotificationLink(
        notification({
          type: 'post_comment_reply',
          entityType: 'post',
          entityId: '',
          commentId: 'comment-1',
        }),
      ),
    ).toBe('/posts');
    expect(
      getNotificationLink(
        notification({
          type: 'event_modified',
          entityType: 'event',
          entityId: null,
          commentId: null,
        }),
      ),
    ).toBe('/events');
  });

  it('uses entityType for unknown non-comment post notification fallbacks', () => {
    expect(
      getNotificationLink(
        notification({
          type: 'unknown_post_notification',
          entityType: 'post',
          entityId: 'post-1',
          commentId: null,
        }),
      ),
    ).toBe('/posts/post-1');
    expect(
      getNotificationLink(
        notification({
          type: 'unknown_post_notification',
          entityType: 'post',
          entityId: '',
          commentId: null,
        }),
      ),
    ).toBe('/posts');
  });

  it('keeps unknown non-post notification fallbacks on events', () => {
    expect(
      getNotificationLink(
        notification({
          type: 'unknown_event_notification',
          entityType: 'event',
          entityId: 'event-1',
          commentId: null,
        }),
      ),
    ).toBe('/events/event-1');
  });
});
