// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationToast from '../../../src/components/Notifications/NotificationToast';
import { NotificationContext } from '../../../src/runtime/providers/notification-context';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('../../../src/runtime/client/use-cases/notification-use-cases', () => ({
  fetchMoreNotifications: vi.fn(),
  fetchMoreUnreadNotifications: vi.fn(),
  markNotificationAsRead: vi.fn(),
  watchNotifications: vi.fn(),
  watchUnreadNotifications: vi.fn(),
}));

vi.mock('@/runtime/client/use-cases/notification-use-cases', () => ({
  fetchMoreNotifications: vi.fn(),
  fetchMoreUnreadNotifications: vi.fn(),
  markNotificationAsRead: vi.fn(),
  watchNotifications: vi.fn(),
  watchUnreadNotifications: vi.fn(),
}));

vi.mock('@/runtime/client/use-cases/auth-use-cases', () => ({
  default: vi.fn(),
}));

const baseToast = {
  id: 'notification-1',
  recipientUid: 'recipient-1',
  type: 'post_new_comment',
  actorUid: 'actor-1',
  actorName: 'Runner',
  actorPhotoURL: '',
  entityType: 'post',
  entityId: 'post-1',
  entityTitle: '跑步心得',
  commentId: 'comment-1',
  message: '有人留言了',
  read: false,
  createdAt: new Date(),
};

/**
 * Renders NotificationToast with a focused context value.
 * @param {object} overrides - Context overrides.
 * @returns {{ markAsRead: import('vitest').Mock, dismissNotificationToast: import('vitest').Mock }} Mocks.
 */
function renderToast(overrides = {}) {
  const markAsRead = vi.fn().mockResolvedValue(undefined);
  const dismissNotificationToast = vi.fn();
  render(
    <NotificationContext.Provider
      value={{
        unreadCount: 0,
        notifications: [],
        isPanelOpen: false,
        togglePanel: vi.fn(),
        activeTab: 'all',
        setActiveTab: vi.fn(),
        closePanel: vi.fn(),
        markAsRead,
        hasMore: false,
        isLoadingMore: false,
        hasLoadedMore: false,
        loadMore: vi.fn(),
        currentToast: baseToast,
        dismissNotificationToast,
        bellButtonRef: { current: null },
        ...overrides,
      }}
    >
      <NotificationToast />
    </NotificationContext.Provider>,
  );
  return { markAsRead, dismissNotificationToast };
}

describe('NotificationToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the notification message and view action', () => {
    renderToast();

    expect(screen.getByText('有人留言了')).toBeTruthy();
    expect(screen.getByText('查看')).toBeTruthy();
  });

  it('dismisses, marks as read, and navigates when clicked', async () => {
    const user = userEvent.setup();
    const { markAsRead, dismissNotificationToast } = renderToast();

    await user.click(screen.getByRole('button', { name: /有人留言了.*查看/ }));

    expect(dismissNotificationToast).toHaveBeenCalledWith('notification-1');
    expect(markAsRead).toHaveBeenCalledWith('notification-1');
    expect(mocks.push).toHaveBeenCalledWith('/posts/post-1?commentId=comment-1');
  });

  it('still navigates when marking as read fails', async () => {
    const user = userEvent.setup();
    const markAsRead = vi.fn().mockRejectedValue(new Error('mark failed'));
    renderToast({ markAsRead });

    await user.click(screen.getByRole('button', { name: /有人留言了.*查看/ }));

    expect(markAsRead).toHaveBeenCalledWith('notification-1');
    expect(mocks.push).toHaveBeenCalledWith('/posts/post-1?commentId=comment-1');
  });
});
