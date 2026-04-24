import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRelativeTime, getNotificationLink } from '@/lib/notification-helpers';
import { buildNotificationMessage } from '@/service/notification-service';

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------
describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-14T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "剛剛" when timestamp is less than 1 minute ago', () => {
    // Arrange
    const date = new Date('2026-04-14T11:59:30Z'); // 30 seconds ago

    // Act
    const result = formatRelativeTime(date);

    // Assert
    expect(result).toBe('剛剛');
  });

  it('should return "剛剛" when timestamp is exactly 1 minute ago', () => {
    // Arrange
    const date = new Date('2026-04-14T11:59:00Z'); // 60 seconds ago

    // Act
    const result = formatRelativeTime(date);

    // Assert
    expect(result).toBe('剛剛');
  });

  it('should return minutes ago when timestamp is within 1 hour', () => {
    // Arrange
    const date = new Date('2026-04-14T11:55:00Z'); // 5 minutes ago

    // Act
    const result = formatRelativeTime(date);

    // Assert
    expect(result).toBe('5 分鐘前');
  });

  it('should return hours ago when timestamp is within 1 day', () => {
    // Arrange
    const date = new Date('2026-04-14T09:00:00Z'); // 3 hours ago

    // Act
    const result = formatRelativeTime(date);

    // Assert
    expect(result).toBe('3 小時前');
  });

  it('should return days ago when timestamp is within 1 week', () => {
    // Arrange
    const date = new Date('2026-04-12T12:00:00Z'); // 2 days ago

    // Act
    const result = formatRelativeTime(date);

    // Assert
    expect(result).toBe('2 天前');
  });

  it('should return month/day when timestamp is more than 1 week ago', () => {
    // Arrange
    const date = new Date('2026-04-06T12:00:00Z'); // 8 days ago

    // Act
    const result = formatRelativeTime(date);

    // Assert
    expect(result).toBe('4/6');
  });

  it('should handle Firestore Timestamp with toDate() method', () => {
    // Arrange
    const date = new Date('2026-04-14T11:50:00Z'); // 10 minutes ago
    const firestoreTimestamp = /** @type {import('firebase/firestore').Timestamp} */ ({
      toDate: () => date,
    });

    // Act
    const result = formatRelativeTime(firestoreTimestamp);

    // Assert
    expect(result).toBe('10 分鐘前');
  });

  it('should return "1 小時前" when timestamp is exactly 1 hour ago', () => {
    // Arrange
    const date = new Date('2026-04-14T11:00:00Z'); // exactly 1 hour + 1ms boundary

    // Act — 60 minutes = 1 hour, should show hours
    const result = formatRelativeTime(date);

    // Assert
    expect(result).toBe('1 小時前');
  });

  it('should return "1 天前" when timestamp is exactly 1 day ago', () => {
    // Arrange
    const date = new Date('2026-04-13T12:00:00Z'); // 24 hours ago

    // Act
    const result = formatRelativeTime(date);

    // Assert
    expect(result).toBe('1 天前');
  });
});

// ---------------------------------------------------------------------------
// buildNotificationMessage
// ---------------------------------------------------------------------------
describe('buildNotificationMessage', () => {
  it('should return correct message for event_modified', () => {
    // Arrange
    const type = 'event_modified';
    const title = '週末登山團';

    // Act
    const result = buildNotificationMessage(type, title);

    // Assert
    expect(result).toBe('你所參加的『週末登山團』活動資訊有更動');
  });

  it('should return correct message for event_cancelled', () => {
    // Arrange
    const type = 'event_cancelled';
    const title = '晨跑社練習';

    // Act
    const result = buildNotificationMessage(type, title);

    // Assert
    expect(result).toBe('你所參加的『晨跑社練習』已取消');
  });

  it('should return correct message for post_new_comment', () => {
    // Arrange
    const type = 'post_new_comment';
    const title = '台北馬拉松心得';

    // Act
    const result = buildNotificationMessage(type, title);

    // Assert
    expect(result).toBe('你的文章『台北馬拉松心得』有一則新的留言');
  });
});

// ---------------------------------------------------------------------------
// getNotificationLink
// ---------------------------------------------------------------------------
describe('getNotificationLink', () => {
  it('should return event URL for event_modified', () => {
    // Arrange
    const notification = /** @type {import('@/service/notification-service').NotificationItem} */ ({
      type: 'event_modified',
      entityType: 'event',
      entityId: 'evt123',
      commentId: null,
    });

    // Act
    const result = getNotificationLink(notification);

    // Assert
    expect(result).toBe('/events/evt123');
  });

  it('should return event URL for event_cancelled', () => {
    // Arrange
    const notification = /** @type {import('@/service/notification-service').NotificationItem} */ ({
      type: 'event_cancelled',
      entityType: 'event',
      entityId: 'evt456',
      commentId: null,
    });

    // Act
    const result = getNotificationLink(notification);

    // Assert
    expect(result).toBe('/events/evt456');
  });

  it('should return post URL with commentId for post_new_comment', () => {
    // Arrange
    const notification = /** @type {import('@/service/notification-service').NotificationItem} */ ({
      type: 'post_new_comment',
      entityType: 'post',
      entityId: 'post789',
      commentId: 'cmt001',
    });

    // Act
    const result = getNotificationLink(notification);

    // Assert
    expect(result).toBe('/posts/post789?commentId=cmt001');
  });
});
