/**
 * @typedef {import('@/service/notification-service').Actor} Actor
 * @typedef {import('@/service/notification-service').NotificationItem} NotificationItem
 * @typedef {import('@/service/notification-service').NotificationType} NotificationType
 */

export {
  formatRelativeTime,
  buildNotificationMessage,
  getNotificationLink,
} from '@/lib/notification-helpers';

export {
  notifyEventModified,
  notifyEventCancelled,
  notifyPostNewComment,
  fetchDistinctCommentAuthors,
  notifyPostCommentReply,
  notifyEventNewComment,
  watchNotifications,
  watchUnreadNotifications,
  fetchMoreNotifications,
  fetchMoreUnreadNotifications,
  markNotificationAsRead,
} from '@/runtime/client/use-cases/notification-use-cases';
