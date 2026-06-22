// @vitest-environment jsdom

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useContext } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationProvider from '../../../src/runtime/providers/NotificationProvider';
import { AuthContext } from '../../../src/runtime/providers/AuthProvider';
import { NotificationContext } from '../../../src/runtime/providers/notification-context';
import { ToastContext } from '../../../src/runtime/providers/ToastProvider';

const mocks = vi.hoisted(() => ({
  markNotificationAsRead: vi.fn(),
  watchNotifications: vi.fn(),
  watchUnreadNotifications: vi.fn(),
}));

vi.mock('../../../src/runtime/client/use-cases/notification-use-cases', () => ({
  fetchMoreNotifications: vi.fn(),
  fetchMoreUnreadNotifications: vi.fn(),
  markNotificationAsRead: mocks.markNotificationAsRead,
  watchNotifications: mocks.watchNotifications,
  watchUnreadNotifications: mocks.watchUnreadNotifications,
}));

vi.mock('../../../src/runtime/client/use-cases/auth-use-cases', () => ({
  default: vi.fn(),
}));

const baseNotification = {
  id: 'notification-1',
  recipientUid: 'recipient-1',
  type: 'event_comment_reply',
  actorUid: 'actor-1',
  actorName: 'Runner',
  actorPhotoURL: '',
  entityType: 'event',
  entityId: 'event-1',
  entityTitle: '晨跑',
  commentId: 'comment-1',
  message: '活動有新回覆',
  read: false,
  createdAt: new Date(),
};

/**
 * Builds a notification.
 * @param {object} overrides - Field overrides.
 * @returns {typeof baseNotification} Notification item.
 */
function notification(overrides = {}) {
  return { ...baseNotification, ...overrides };
}

/**
 * Consumer exposing toast state and context actions.
 * @returns {import('react').ReactElement} Test consumer.
 */
function ProviderProbe() {
  const { currentToast, markAsRead, dismissNotificationToast } = useContext(NotificationContext);

  return (
    <>
      <output aria-label="current-toast">{JSON.stringify(currentToast)}</output>
      <button type="button" onClick={() => markAsRead('notification-1')}>
        mark-current
      </button>
      <button type="button" onClick={() => markAsRead('notification-2')}>
        mark-queued
      </button>
      <button type="button" onClick={() => dismissNotificationToast?.('notification-1')}>
        dismiss-current
      </button>
    </>
  );
}

/**
 * Builds an auth context value for provider tests.
 * @param {object|null} userOverrides - Auth user overrides or null for signed out.
 * @returns {import('../../../src/runtime/providers/AuthProvider').AuthContextValue} Auth context value.
 */
function buildAuthContextValue(userOverrides = {}) {
  if (userOverrides === null) {
    return {
      user: null,
      setUser: vi.fn(),
      loading: false,
    };
  }

  return {
    user: {
      uid: 'recipient-1',
      name: 'Runner',
      email: 'runner@example.test',
      photoURL: null,
      bio: null,
      accountStatus: 'active',
      deletionScheduledFor: null,
      getIdToken: vi.fn(),
      ...userOverrides,
    },
    setUser: vi.fn(),
    loading: false,
  };
}

/**
 * Wraps provider children in test auth/toast providers.
 * @param {object} props - Component props.
 * @param {import('react').ReactNode} props.children - Children.
 * @param {object|null} props.userOverrides - Auth user overrides or null.
 * @returns {import('react').ReactElement} Wrapper.
 */
function ProviderHarness({ children, userOverrides }) {
  return (
    <AuthContext.Provider value={buildAuthContextValue(userOverrides)}>
      <ToastContext.Provider value={{ toasts: [], showToast: vi.fn(), removeToast: vi.fn() }}>
        {children}
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}

/**
 * Renders NotificationProvider with mocked auth/toast contexts.
 * @param {object|null} [userOverrides] - Auth user overrides or null for signed out.
 * @returns {import('@testing-library/react').RenderResult} Render result.
 */
function renderProvider(userOverrides = {}) {
  return render(
    <ProviderHarness userOverrides={userOverrides}>
      <NotificationProvider>
        <ProviderProbe />
      </NotificationProvider>
    </ProviderHarness>,
  );
}

/**
 * Waits for pending toast queue microtasks.
 * @returns {Promise<void>} Flush completion.
 */
function flushToastQueue() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Emits new notifications through the watchNotifications new-notification callback.
 * @param {typeof baseNotification[]} items - New notifications.
 */
function emitNewNotifications(items) {
  const onNewNotifications = mocks.watchNotifications.mock.calls[0][3];
  act(() => {
    onNewNotifications(items);
  });
}

describe('NotificationProvider toast queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.markNotificationAsRead.mockResolvedValue(undefined);
    mocks.watchUnreadNotifications.mockReturnValue(vi.fn());
    mocks.watchNotifications.mockReturnValue(vi.fn());
  });

  it('keeps the complete notification payload for new notification toasts', async () => {
    const createdAt = new Date('2026-06-22T08:00:00.000Z');
    renderProvider();

    emitNewNotifications([
      notification({
        actorUid: 'actor-full',
        actorName: '完整跑者',
        actorPhotoURL: 'https://example.test/avatar.png',
        entityType: 'event',
        entityTitle: '完整活動',
        read: false,
        createdAt,
      }),
    ]);

    await waitFor(() =>
      expect(JSON.parse(screen.getByLabelText('current-toast').textContent || 'null')).toEqual(
        notification({
          actorUid: 'actor-full',
          actorName: '完整跑者',
          actorPhotoURL: 'https://example.test/avatar.png',
          entityType: 'event',
          entityTitle: '完整活動',
          read: false,
          createdAt: createdAt.toISOString(),
        }),
      ),
    );
  });

  it('clears current and queued toasts when the user signs out', async () => {
    const { rerender } = renderProvider();
    emitNewNotifications([
      notification(),
      notification({ id: 'notification-2', message: '第二則通知', commentId: 'comment-2' }),
    ]);

    await waitFor(() => expect(screen.getByLabelText('current-toast').textContent).toContain('notification-1'));

    rerender(
      <ProviderHarness userOverrides={null}>
        <NotificationProvider>
          <ProviderProbe />
        </NotificationProvider>
      </ProviderHarness>,
    );

    await waitFor(() => expect(screen.getByLabelText('current-toast').textContent).toBe('null'));
    await flushToastQueue();
    expect(screen.getByLabelText('current-toast').textContent).toBe('null');
  });

  it('clears current and queued toasts when switching users', async () => {
    const { rerender } = renderProvider();
    emitNewNotifications([
      notification(),
      notification({ id: 'notification-2', message: '第二則通知', commentId: 'comment-2' }),
    ]);

    await waitFor(() => expect(screen.getByLabelText('current-toast').textContent).toContain('notification-1'));

    rerender(
      <ProviderHarness userOverrides={{ uid: 'recipient-2' }}>
        <NotificationProvider>
          <ProviderProbe />
        </NotificationProvider>
      </ProviderHarness>,
    );

    await waitFor(() => expect(screen.getByLabelText('current-toast').textContent).toBe('null'));
    await flushToastQueue();
    expect(screen.getByLabelText('current-toast').textContent).toBe('null');
  });

  it('clears the current toast when that notification is marked as read', async () => {
    const user = userEvent.setup();
    renderProvider();
    emitNewNotifications([notification()]);

    await waitFor(() => expect(screen.getByLabelText('current-toast').textContent).toContain('notification-1'));

    await user.click(screen.getByRole('button', { name: 'mark-current' }));

    await waitFor(() => expect(screen.getByLabelText('current-toast').textContent).toBe('null'));
  });

  it('removes queued toasts with the same id when marked read before display', async () => {
    const user = userEvent.setup();
    renderProvider();
    emitNewNotifications([
      notification(),
      notification({ id: 'notification-2', message: '第二則通知', commentId: 'comment-2' }),
    ]);

    await waitFor(() => expect(screen.getByLabelText('current-toast').textContent).toContain('notification-1'));

    await user.click(screen.getByRole('button', { name: 'mark-queued' }));
    await user.click(screen.getByRole('button', { name: 'dismiss-current' }));

    await waitFor(() => expect(screen.getByLabelText('current-toast').textContent).toBe('null'));
  });
});
