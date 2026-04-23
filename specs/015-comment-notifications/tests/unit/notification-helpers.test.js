import { describe, it, expect } from 'vitest';
import { getNotificationLink } from '@/lib/notification-helpers';
import { buildNotificationMessage } from '@/service/notification-service';

/**
 * 建立測試用的最小通知物件（僅含 getNotificationLink 需要的欄位）。
 * @param {object} partial - 部分通知屬性。
 * @param {string} partial.type - 通知類型。
 * @param {string} partial.entityId - 實體 ID。
 * @param {string|null} partial.commentId - 留言 ID。
 * @returns {import('@/service/notification-service').NotificationItem} 測試用通知物件。
 */
function makeNotification({ type, entityId, commentId }) {
  return /** @type {import('@/service/notification-service').NotificationItem} */ ({
    type,
    entityId,
    commentId,
  });
}

describe('buildNotificationMessage', () => {
  describe('既有類型（應持續通過）', () => {
    it('event_modified — 回傳活動資訊更動訊息', () => {
      const result = buildNotificationMessage('event_modified', '登山趣');

      expect(result).toBe('你所參加的『登山趣』活動資訊有更動');
    });

    it('event_cancelled — 回傳活動取消訊息', () => {
      const result = buildNotificationMessage('event_cancelled', '登山趣');

      expect(result).toBe('你所參加的『登山趣』已取消');
    });

    it('post_new_comment — 回傳文章新留言訊息', () => {
      const result = buildNotificationMessage('post_new_comment', '週末好去處');

      expect(result).toBe('你的文章『週末好去處』有一則新的留言');
    });
  });

  describe('新增類型（RED — 尚未實作）', () => {
    it('post_comment_reply — 回傳文章留言串新留言訊息', () => {
      const result = buildNotificationMessage('post_comment_reply', '週末好去處');

      expect(result).toBe('你留言過的文章『週末好去處』有一則新的留言');
    });

    it('event_host_comment — 回傳主辦活動新留言訊息', () => {
      const result = buildNotificationMessage('event_host_comment', '登山趣');

      expect(result).toBe('你主辦的活動『登山趣』有一則新的留言');
    });

    it('event_participant_comment — 回傳參加活動新留言訊息', () => {
      const result = buildNotificationMessage('event_participant_comment', '登山趣');

      expect(result).toBe('你參加的活動『登山趣』有一則新的留言');
    });

    it('event_comment_reply — 回傳活動留言串新留言訊息', () => {
      const result = buildNotificationMessage('event_comment_reply', '登山趣');

      expect(result).toBe('你留言過的活動『登山趣』有一則新的留言');
    });
  });
});

describe('getNotificationLink', () => {
  describe('既有類型（應持續通過）', () => {
    it('post_new_comment — 回傳含 commentId 的文章連結', () => {
      const notification = makeNotification({
        type: 'post_new_comment',
        entityId: 'post-1',
        commentId: 'c-1',
      });

      const result = getNotificationLink(notification);

      expect(result).toBe('/posts/post-1?commentId=c-1');
    });

    it('event_modified — 回傳活動連結', () => {
      const notification = makeNotification({
        type: 'event_modified',
        entityId: 'event-1',
        commentId: null,
      });

      const result = getNotificationLink(notification);

      expect(result).toBe('/events/event-1');
    });

    it('event_cancelled — 回傳活動連結', () => {
      const notification = makeNotification({
        type: 'event_cancelled',
        entityId: 'event-1',
        commentId: null,
      });

      const result = getNotificationLink(notification);

      expect(result).toBe('/events/event-1');
    });
  });

  describe('新增類型（RED — 尚未實作）', () => {
    it('post_comment_reply — 回傳含 commentId 的文章連結', () => {
      const notification = makeNotification({
        type: 'post_comment_reply',
        entityId: 'post-2',
        commentId: 'c-2',
      });

      const result = getNotificationLink(notification);

      expect(result).toBe('/posts/post-2?commentId=c-2');
    });

    it('event_host_comment — 回傳含 commentId 的活動連結', () => {
      const notification = makeNotification({
        type: 'event_host_comment',
        entityId: 'event-2',
        commentId: 'c-3',
      });

      const result = getNotificationLink(notification);

      expect(result).toBe('/events/event-2?commentId=c-3');
    });

    it('event_participant_comment — 回傳含 commentId 的活動連結', () => {
      const notification = makeNotification({
        type: 'event_participant_comment',
        entityId: 'event-3',
        commentId: 'c-4',
      });

      const result = getNotificationLink(notification);

      expect(result).toBe('/events/event-3?commentId=c-4');
    });

    it('event_comment_reply — 回傳含 commentId 的活動連結', () => {
      const notification = makeNotification({
        type: 'event_comment_reply',
        entityId: 'event-4',
        commentId: 'c-5',
      });

      const result = getNotificationLink(notification);

      expect(result).toBe('/events/event-4?commentId=c-5');
    });
  });
});
